#!/usr/bin/env npx tsx
/**
 * Data Quality Guardian — 7-pass audit across placements, dedup, tags, and "so what?" copy.
 *
 * npm run data-quality:audit
 * npm run data-quality:audit -- --domain commbank.com.au --json
 */
import { getSupabaseAdmin } from "./lib/supabaseAdmin.ts";
import { argBool, argString, parseArgs } from "./lib/parseArgs.ts";
import { auditPlacementRow } from "../src/lib/soWhatQuality.ts";
import { fingerprintFromPlacementRow } from "../src/lib/placementFingerprint.ts";

type Severity = "error" | "warn" | "info";

type Finding = {
  pass: number;
  passName: string;
  severity: Severity;
  code: string;
  message: string;
  domain?: string;
  placementId?: number | string;
  field?: string;
};

const PASS_NAMES = [
  "Schema & connections",
  "Fingerprint coverage",
  "Duplicate groups",
  "Cross-source redundancy",
  "AI tag quality",
  "So-what narrative quality",
  "Count integrity (raw vs deduped)",
] as const;

async function main() {
  const args = parseArgs(process.argv);
  const domainFilter = argString(args, "domain");
  const jsonOut = argBool(args, "json");
  const limit = Number(argString(args, "limit") ?? "2000");
  const save = argBool(args, "save");

  const supabase = getSupabaseAdmin();
  const findings: Finding[] = [];
  const startedAt = new Date().toISOString();

  // ── Pass 1: Schema & connections ─────────────────────────────────────────
  const tables = ["ad_placements", "placement_sources", "adlibrary_advertiser_candidates"] as const;
  for (const table of tables) {
    const { error } = await supabase.from(table).select("*").limit(1);
    if (error) {
      findings.push({
        pass: 1,
        passName: PASS_NAMES[0],
        severity: "error",
        code: "TABLE_UNAVAILABLE",
        message: `Cannot read ${table}: ${error.message}`,
      });
    }
  }

  let query = supabase.from("ad_placements").select("*").limit(limit);
  if (domainFilter) query = query.ilike("domain", `%${domainFilter}%`);

  const { data: rawRows, error: rowsErr } = await query;
  if (rowsErr) {
    console.error("Failed to load placements:", rowsErr.message);
    process.exit(1);
  }

  const rows = (rawRows ?? []) as Record<string, unknown>[];
  const domains = new Set(rows.map((r) => String(r.domain ?? "")));

  // ── Pass 2: Fingerprint coverage ───────────────────────────────────────────
  const missingFp = rows.filter((r) => !r.canonical_fingerprint && !r.creative_hash);
  const coveragePct =
    rows.length > 0
      ? Math.round(((rows.length - missingFp.length) / rows.length) * 1000) / 10
      : 100;

  if (coveragePct < 95) {
    findings.push({
      pass: 2,
      passName: PASS_NAMES[1],
      severity: coveragePct < 80 ? "error" : "warn",
      code: "LOW_FINGERPRINT_COVERAGE",
      message: `Only ${coveragePct}% of sampled placements have canonical_fingerprint or creative_hash (${missingFp.length}/${rows.length})`,
    });
  }

  for (const row of rows.filter((r) => !r.canonical_fingerprint)) {
    const computed = fingerprintFromPlacementRow(row);
    findings.push({
      pass: 2,
      passName: PASS_NAMES[1],
      severity: "info",
      code: "FINGERPRINT_BACKFILL_NEEDED",
      message: `Row ${row.id} missing canonical_fingerprint (computed: ${computed.slice(0, 48)}…)`,
      domain: String(row.domain ?? ""),
      placementId: row.id as number,
    });
  }

  // ── Pass 3: Duplicate groups ───────────────────────────────────────────────
  const fpGroups = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const fp =
      (row.canonical_fingerprint as string) ??
      (row.creative_hash as string) ??
      fingerprintFromPlacementRow(row);
    const key = `${String(row.domain ?? "").toLowerCase()}::${fp}`;
    const bucket = fpGroups.get(key) ?? [];
    bucket.push(row);
    fpGroups.set(key, bucket);
  }

  let duplicateGroups = 0;
  for (const [key, group] of fpGroups) {
    if (group.length <= 1) continue;
    duplicateGroups++;
    findings.push({
      pass: 3,
      passName: PASS_NAMES[2],
      severity: "error",
      code: "DUPLICATE_CANONICAL_GROUP",
      message: `${group.length} rows share fingerprint ${key.split("::")[1]?.slice(0, 40)}… — merge required`,
      domain: String(group[0]?.domain ?? ""),
    });
  }

  // ── Pass 4: Cross-source redundancy ────────────────────────────────────────
  const sourceByFp = new Map<string, Set<string>>();
  for (const row of rows) {
    const fp =
      (row.canonical_fingerprint as string) ??
      fingerprintFromPlacementRow(row);
    const sources = sourceByFp.get(fp) ?? new Set<string>();
    if (row.source_platform) sources.add(String(row.source_platform));
    sourceByFp.set(fp, sources);
  }

  for (const [fp, sources] of sourceByFp) {
    if (sources.has("adlibrary") && sources.has("apify")) {
      findings.push({
        pass: 4,
        passName: PASS_NAMES[3],
        severity: "warn",
        code: "ADLIBRARY_APIFY_OVERLAP",
        message: `Creative ${fp.slice(0, 40)}… indexed from both adlibrary and apify — ensure canonical merge`,
      });
    }
  }

  // ── Pass 5 & 6: AI tags + So-what quality ──────────────────────────────────
  for (const row of rows) {
    const issues = auditPlacementRow(row);
    for (const issue of issues) {
      const isSoWhat = ["strategist_takeaway", "hook_analysis", "market_signal", "offer_signal"].includes(
        issue.field,
      );
      findings.push({
        pass: isSoWhat ? 6 : 5,
        passName: isSoWhat ? PASS_NAMES[5] : PASS_NAMES[4],
        severity: issue.severity,
        code: isSoWhat ? "SO_WHAT_QUALITY" : "AI_TAG_QUALITY",
        message: `${issue.field}: ${issue.reason} — "${issue.value}"`,
        domain: issue.domain,
        placementId: issue.placementId,
        field: issue.field,
      });
    }
  }

  // ── Pass 7: Count integrity ────────────────────────────────────────────────
  let normalizedCount: number | null = null;
  if (domainFilter) {
    const { count } = await supabase
      .from("normalized_ad_placements")
      .select("id", { count: "exact", head: true })
      .ilike("domain", `%${domainFilter}%`);
    normalizedCount = count ?? null;
  }

  for (const domain of domains) {
    if (!domain) continue;
    const domainRows = rows.filter((r) => String(r.domain ?? "").toLowerCase().includes(domain.toLowerCase()));
    const uniqueFp = new Set(
      domainRows.map(
        (r) =>
          (r.canonical_fingerprint as string) ??
          (r.creative_hash as string) ??
          fingerprintFromPlacementRow(r),
      ),
    );
    const inflationPct =
      uniqueFp.size > 0
        ? Math.round(((domainRows.length - uniqueFp.size) / uniqueFp.size) * 1000) / 10
        : 0;

    if (inflationPct > 5) {
      findings.push({
        pass: 7,
        passName: PASS_NAMES[6],
        severity: inflationPct > 20 ? "error" : "warn",
        code: "COUNT_INFLATION",
        message: `${domain}: ${domainRows.length} raw rows vs ${uniqueFp.size} unique creatives (+${inflationPct}% inflation)${normalizedCount != null ? ` · normalized view: ${normalizedCount}` : ""}`,
        domain,
      });
    }
  }

  if (domainFilter && normalizedCount != null && rows.length > 0) {
    const uniqueSize = new Set(
      rows.map(
        (r) =>
          (r.canonical_fingerprint as string) ??
          (r.creative_hash as string) ??
          fingerprintFromPlacementRow(r),
      ),
    ).size;
    if (normalizedCount <= uniqueSize && rows.length > uniqueSize) {
      findings.push({
        pass: 7,
        passName: PASS_NAMES[6],
        severity: "info",
        code: "UI_SHOULD_USE_NORMALIZED",
        message: `UI/analyzed count should be ${normalizedCount} (normalized view), not ${rows.length} raw rows`,
        domain: domainFilter,
      });
    }
  }

  const errors = findings.filter((f) => f.severity === "error").length;
  const warnings = findings.filter((f) => f.severity === "warn").length;

  const report = {
    startedAt,
    finishedAt: new Date().toISOString(),
    domainFilter: domainFilter ?? null,
    placementsChecked: rows.length,
    domainsChecked: domains.size,
    duplicateGroups,
    canonicalCoveragePct: coveragePct,
    errors,
    warnings,
    findings,
    passes: PASS_NAMES.map((name, i) => ({
      pass: i + 1,
      name,
      findings: findings.filter((f) => f.pass === i + 1).length,
    })),
  };

  if (jsonOut) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("\n═══ Data Quality Guardian — 7-pass audit ═══\n");
    console.log(`Placements sampled: ${rows.length} · Domains: ${domains.size}`);
    console.log(`Canonical coverage: ${coveragePct}% · Duplicate groups: ${duplicateGroups}`);
    console.log(`Errors: ${errors} · Warnings: ${warnings}\n`);

    for (let i = 1; i <= 7; i++) {
      const passFindings = findings.filter((f) => f.pass === i);
      const icon = passFindings.some((f) => f.severity === "error")
        ? "✗"
        : passFindings.some((f) => f.severity === "warn")
          ? "!"
          : "✓";
      console.log(`Pass ${i} ${icon} ${PASS_NAMES[i - 1]} — ${passFindings.length} finding(s)`);
      for (const f of passFindings.slice(0, 5)) {
        console.log(`  [${f.severity}] ${f.code}: ${f.message}`);
      }
      if (passFindings.length > 5) console.log(`  … and ${passFindings.length - 5} more`);
    }

    console.log(errors > 0 ? "\n❌ Audit FAILED — fix errors before client demo\n" : "\n✅ Audit passed (review warnings)\n");
  }

  if (save) {
    try {
      await supabase.from("data_quality_runs").insert({
        finished_at: new Date().toISOString(),
        pass_count: 7,
        errors,
        warnings,
        domains_checked: domains.size,
        placements_checked: rows.length,
        duplicate_groups: duplicateGroups,
        report,
        status: errors > 0 ? "failed" : "passed",
      });
    } catch {
      console.warn("Could not save to data_quality_runs (run migration first)");
    }
  }

  if (errors > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
