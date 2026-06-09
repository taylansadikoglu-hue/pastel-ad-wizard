import React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface Props {
  domain: string
  advertiserCount?: number
  estMonthlySpend?: number | null
  primaryChannel?: string | null
  dashboardUrl: string
  recipientName?: string | null
}

const formatCurrency = (n: number | null | undefined) => {
  if (n == null || isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

const ScanReadyEmail = ({
  domain,
  advertiserCount,
  estMonthlySpend,
  primaryChannel,
  dashboardUrl,
  recipientName,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      Your competitor scan for {domain} is ready — {advertiserCount ?? 0} advertisers uncovered
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brand}>
          <Text style={brandMark}>RevenueAd</Text>
        </Section>

        <Section style={card}>
          <Text style={eyebrow}>Scan complete</Text>
          <Heading style={h1}>
            Your competitive intel for{' '}
            <span style={{ color: '#F7A501' }}>{domain}</span> is ready.
          </Heading>
          <Text style={lede}>
            {recipientName ? `${recipientName}, we` : 'We'} finished scraping every active ad,
            enriching advertiser fingerprints, and crunching the spend signals. Open the dashboard
            to see the full picture.
          </Text>

          <Section style={statsRow}>
            <Section style={statCell}>
              <Text style={statValue}>{advertiserCount != null ? String(advertiserCount) : '—'}</Text>
              <Text style={statLabel}>Advertisers</Text>
            </Section>
            <Section style={statCell}>
              <Text style={statValue}>{formatCurrency(estMonthlySpend)}</Text>
              <Text style={statLabel}>Est. monthly spend</Text>
            </Section>
            <Section style={statCell}>
              <Text style={statValue}>{primaryChannel ?? '—'}</Text>
              <Text style={statLabel}>Primary channel</Text>
            </Section>
          </Section>

          <Section style={ctaWrap}>
            <Link href={dashboardUrl} style={cta}>
              Open the dashboard →
            </Link>
          </Section>

          <Hr style={hr} />

          <Text style={small}>
            Inside you'll find every ad creative, copy hook, channel mix and estimated spend for{' '}
            <strong>{domain}</strong> — ready to inform your next campaign.
          </Text>
        </Section>

        <Section style={footer}>
          <Text style={footerText}>
            RevenueAd · Competitive ad intelligence for performance teams
          </Text>
          <Text style={footerText}>
            <Link href="https://revenuad.com" style={footerLink}>
              revenuad.com
            </Link>
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default ScanReadyEmail

// Styles — inline, email-safe
const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  margin: 0,
  padding: '40px 16px',
}

const container = {
  maxWidth: '560px',
  margin: '0 auto',
}

const brand = {
  padding: '0 0 24px 0',
  textAlign: 'center' as const,
}

const brandMark = {
  margin: 0,
  fontSize: '14px',
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  color: '#23251D',
}

const card = {
  backgroundColor: '#F4F4F0',
  border: '1.5px solid #23251D',
  borderRadius: '6px',
  boxShadow: '4px 4px 0 0 #23251D',
  padding: '40px 32px 32px',
}

const eyebrow = {
  margin: 0,
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase' as const,
  color: '#F7A501',
}

const h1 = {
  margin: '12px 0 16px',
  fontSize: '28px',
  lineHeight: 1.2,
  fontWeight: 700,
  color: '#23251D',
  letterSpacing: '-0.01em',
}

const lede = {
  margin: '0 0 28px',
  fontSize: '15px',
  lineHeight: 1.6,
  color: '#3d3f33',
}

const statsRow = {
  display: 'table' as const,
  width: '100%',
  borderCollapse: 'separate' as const,
  borderSpacing: '8px 0',
  margin: '0 -4px 28px',
}

const statCell = {
  display: 'table-cell' as const,
  width: '33.33%',
  backgroundColor: '#ffffff',
  border: '1.5px solid #23251D',
  borderRadius: '4px',
  padding: '14px 10px',
  textAlign: 'center' as const,
  verticalAlign: 'middle' as const,
}

const statValue = {
  margin: 0,
  fontSize: '20px',
  fontWeight: 700,
  color: '#23251D',
  lineHeight: 1.1,
}

const statLabel = {
  margin: '4px 0 0',
  fontSize: '10px',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: '#6b6d5e',
}

const ctaWrap = {
  textAlign: 'center' as const,
  margin: '8px 0 4px',
}

const cta = {
  display: 'inline-block',
  backgroundColor: '#F7A501',
  color: '#23251D',
  border: '1.5px solid #23251D',
  borderRadius: '4px',
  padding: '14px 28px',
  fontSize: '15px',
  fontWeight: 700,
  textDecoration: 'none',
  boxShadow: '3px 3px 0 0 #23251D',
}

const hr = {
  border: 'none',
  borderTop: '1px solid #d9d9cf',
  margin: '28px 0 20px',
}

const small = {
  margin: 0,
  fontSize: '13px',
  lineHeight: 1.6,
  color: '#6b6d5e',
}

const footer = {
  padding: '24px 8px 0',
  textAlign: 'center' as const,
}

const footerText = {
  margin: '2px 0',
  fontSize: '12px',
  color: '#9a9b8c',
}

const footerLink = {
  color: '#6b6d5e',
  textDecoration: 'none',
}
