import { createFileRoute } from '@tanstack/react-router'
import { render } from '@react-email/components'
import React from 'react'
import { z } from 'zod'
import { enrichDomainScanWithMarketSignals } from '@/lib/feeds/enrich-domain-scan'
import { formatPct, formatVisits } from '@/lib/feeds/normalize-domain'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import ScanReadyEmail from '@/lib/email-templates/scan-ready'
import { getEmailService } from '@/lib/email'

const BodySchema = z.object({
  scan_id: z.union([z.number(), z.string()]).transform((v) => Number(v)),
})

const DASHBOARD_BASE = 'https://revenuad.com/app/advertisers'

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}

export const Route = createFileRoute('/api/public/hooks/scan-ready')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1. Verify shared secret (Bearer)
        const auth = request.headers.get('authorization') ?? ''
        const provided = auth.startsWith('Bearer ') ? auth.slice(7) : ''
        if (!provided) return new Response('Unauthorized', { status: 401 })

        const { data: secretRow, error: secretErr } = await supabaseAdmin
          .from('webhook_secrets')
          .select('value')
          .eq('name', 'scan_ready')
          .maybeSingle()
        if (secretErr || !secretRow?.value) {
          console.error('scan-ready: secret lookup failed', secretErr)
          return new Response('Server misconfigured', { status: 500 })
        }
        if (!timingSafeEqual(provided, secretRow.value)) {
          return new Response('Unauthorized', { status: 401 })
        }

        // 2. Parse + validate
        let parsed
        try {
          parsed = BodySchema.parse(await request.json())
        } catch {
          return new Response('Bad request', { status: 400 })
        }
        const scanId = parsed.scan_id

        // 3. Idempotency: mark sent
        const { data: scan, error: scanErr } = await supabaseAdmin
          .from('domain_scans')
          .select('id, domain, user_id, status')
          .eq('id', scanId)
          .maybeSingle()
        if (scanErr || !scan) {
          console.error('scan-ready: scan not found', scanId, scanErr)
          return new Response('Scan not found', { status: 404 })
        }

        // Claim send slot atomically (insert into log; unique key prevents dupes)
        const { error: claimErr } = await supabaseAdmin
          .from('scan_email_log')
          .insert({ scan_id: scan.id, recipient: 'pending' })
        if (claimErr) {
          // 23505 = unique violation => already sent
          if ((claimErr as any).code === '23505') {
            return Response.json({ ok: true, skipped: 'already_sent' })
          }
          console.error('scan-ready: claim failed', claimErr)
          return new Response('Claim failed', { status: 500 })
        }

        // 4. Look up user email
        if (!scan.user_id) {
          return Response.json({ ok: true, skipped: 'no_user' })
        }
        const { data: userRes, error: userErr } =
          await supabaseAdmin.auth.admin.getUserById(scan.user_id)
        const email = userRes?.user?.email
        if (userErr || !email) {
          console.error('scan-ready: user email missing', userErr)
          return new Response('No recipient', { status: 422 })
        }

        // 5. Market signals (Similar Web) — non-fatal, enriches domain_scans.engine_output
        let monthlyVisits: number | null = null
        let visitsChangeLabel: string | null = null
        let categoryPosition: string | null = null
        try {
          const intel = await enrichDomainScanWithMarketSignals(supabaseAdmin, {
            userId: scan.user_id,
            domain: scan.domain,
            persist: true,
          })
          monthlyVisits = intel.traffic?.monthlyVisits ?? null
          if (intel.traffic?.visitsChangePct != null) {
            visitsChangeLabel = formatPct(intel.traffic.visitsChangePct, { fromFraction: true })
          }
          if (intel.traffic?.categoryRank != null) {
            categoryPosition = `#${intel.traffic.categoryRank} ${intel.traffic.category ?? 'category'}`
          }
        } catch (err) {
          console.error('scan-ready: market signals enrich failed', err)
        }

        // 6. Pull enriched stats for the email body
        const [{ data: matrix }, { count: advCount }] = await Promise.all([
          supabaseAdmin
            .from('advertiser_matrix')
            .select('est_monthly_spend, primary_channel')
            .eq('domain', scan.domain)
            .maybeSingle(),
          supabaseAdmin
            .from('ad_placements')
            .select('id', { count: 'exact', head: true })
            .eq('scan_id', scan.id),
        ])

        // 7. Render + send via Resend gateway
        const html = await render(
          React.createElement(ScanReadyEmail, {
            domain: scan.domain,
            advertiserCount: advCount ?? 0,
            estMonthlySpend: matrix?.est_monthly_spend ?? null,
            primaryChannel: matrix?.primary_channel ?? null,
            monthlyVisits: monthlyVisits != null ? formatVisits(monthlyVisits) : null,
            visitsChangeLabel,
            categoryPosition,
            dashboardUrl: `${DASHBOARD_BASE}?domain=${encodeURIComponent(scan.domain)}`,
            recipientName: userRes?.user?.user_metadata?.full_name ?? null,
          }),
        )

        const subject = `Your competitor scan for ${scan.domain} is ready`

        const emailService = getEmailService({ supabase: supabaseAdmin })
        const sendResult = await emailService.send({
          type: 'scan_ready',
          to: email,
          subject,
          html,
          fromRole: 'notifications',
          headers: { 'X-Entity-Ref-ID': `scan-ready-${scan.id}` },
        })

        if (!sendResult.ok) {
          console.error('scan-ready: resend failed', sendResult.error)
          await supabaseAdmin.from('scan_email_log').delete().eq('scan_id', scan.id)
          return new Response(`Send failed: ${sendResult.error}`, { status: 502 })
        }

        const providerId = sendResult.id ?? null

        await supabaseAdmin
          .from('scan_email_log')
          .update({ recipient: email, provider_id: providerId, sent_at: new Date().toISOString() })
          .eq('scan_id', scan.id)

        return Response.json({ ok: true, provider_id: providerId })
      },
    },
  },
})
