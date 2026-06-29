import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Globe, Newspaper, Radar, Megaphone, TrendingUp, Search, Share2 } from "lucide-react";
import { loadDomainIntelligence } from "@/lib/domain-intelligence.functions";
import type { DomainIntelligence, FeedSource } from "@/lib/feeds/types";
import { formatCurrency, formatPct, formatVisits } from "@/lib/feeds/normalize-domain";

const SOURCE_LABELS: Record<FeedSource, string> = {
  similarweb: "Observed market signals",
  dataforseo: "Channel evidence",
  apify: "Creative evidence",
  newspi: "News signal",
};

const STATUS_LABELS: Record<string, string> = {
  ok: "Live",
  empty: "Awaiting data",
  skipped: "Not connected",
  error: "Unavailable",
};

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  ok: { bg: "#E8F5EC", text: "#2D7D46" },
  empty: { bg: "#F7F6F3", text: "#6B6B62" },
  skipped: { bg: "#F7F6F3", text: "#9E9D94" },
  error: { bg: "#FDEEEC", text: "#C0392B" },
};

type Props = {
  domain: string;
  brandLabel?: string | null;
};

export function DataFeedPanel({ domain, brandLabel }: Props) {
  const [intel, setIntel] = useState<DomainIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadDomainIntelligence({ data: { domain, brandLabel, persist: true } });
      setIntel(data);
    } catch {
      setError("Could not refresh market signals. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain, brandLabel]);

  const t = intel?.traffic;

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #EBE9E4",
        borderRadius: 10,
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9E9D94" }}>
            R-AD Engine
          </div>
          <div style={{ fontSize: 17, fontWeight: 600, color: "#1C1C1A", marginTop: 4 }}>
            Market angles & trends
          </div>
          <div style={{ fontSize: 13, color: "#6B6B62", marginTop: 4 }}>
            Visit shifts, category position, search mix, and rivals — pitch-ready context only.
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #EBE9E4",
            background: "#F7F6F3",
            color: "#1C1C1A",
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Refresh
        </button>
      </div>

      {intel && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {(Object.keys(intel.sources) as FeedSource[]).map((key) => {
            const s = intel.sources[key];
            const style = STATUS_STYLE[s.status] ?? STATUS_STYLE.empty;
            return (
              <span
                key={key}
                title={buyerSafeMessage(s.message)}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: style.bg,
                  color: style.text,
                }}
              >
                {SOURCE_LABELS[key]} · {STATUS_LABELS[s.status] ?? s.status}
              </span>
            );
          })}
        </div>
      )}

      {loading && !intel && (
        <div style={{ fontSize: 13, color: "#9E9D94", display: "flex", alignItems: "center", gap: 8 }}>
          <Loader2 size={16} className="animate-spin" /> Loading market signals…
        </div>
      )}

      {error && (
        <div style={{ fontSize: 13, color: "#C0392B", background: "#FDEEEC", padding: "10px 12px", borderRadius: 8 }}>
          {error}
        </div>
      )}

      {intel && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <Metric
              icon={Globe}
              label="Monthly visits"
              value={formatVisits(t?.monthlyVisits)}
              sub={
                t?.visitsChangePct != null
                  ? `${formatPct(t.visitsChangePct, { fromFraction: true })} MoM`
                  : t?.category ?? undefined
              }
              delta={t?.visitsChangePct}
            />
            <Metric
              icon={Radar}
              label="Category position"
              value={t?.categoryRank != null ? `#${t.categoryRank}` : "—"}
              sub={
                [
                  t?.category,
                  t?.categoryRankChange != null && t.categoryRankChange !== 0
                    ? `${t.categoryRankChange > 0 ? "↑" : "↓"}${Math.abs(t.categoryRankChange)}`
                    : null,
                  t?.topCountry && t.topCountryRank != null ? `${t.topCountry} #${t.topCountryRank}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || undefined
              }
            />
            <Metric
              icon={Search}
              label="Search mix"
              value={
                t?.organicSearchShare != null
                  ? `${formatPct(t.organicSearchShare, { fromFraction: true })} organic`
                  : "—"
              }
              sub={
                t?.paidSearchShare != null
                  ? `${formatPct(t.paidSearchShare, { fromFraction: true })} paid · ${t.topKeywords[0] ?? "—"}`
                  : undefined
              }
            />
            <Metric
              icon={Share2}
              label="Social referrals"
              value={t?.topSocialNetwork ?? "—"}
              sub={
                t?.topSocialShare != null
                  ? `${formatPct(t.topSocialShare, { fromFraction: true })} of social traffic`
                  : undefined
              }
            />
            <Metric
              icon={TrendingUp}
              label="Primary traffic"
              value={
                t?.primaryTrafficSource
                  ? t.primaryTrafficSource.replace(/_/g, " ")
                  : "—"
              }
              sub={
                t?.primaryTrafficShare != null
                  ? `${formatPct(t.primaryTrafficShare, { fromFraction: true })} share`
                  : undefined
              }
            />
            <Metric
              icon={Megaphone}
              label="Tracked creative"
              value={formatCurrency(intel.paidMedia?.estimatedMonthlySpend)}
              sub={`${intel.paidMedia?.creativeCount ?? 0} placements`}
            />
            <Metric icon={Newspaper} label="News" value={String(intel.news.length)} sub="Recent headlines" />
          </div>

          {t?.visitTrend && t.visitTrend.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6B6B62", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Visit trend
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {t.visitTrend.map((pt) => (
                  <span
                    key={pt.date}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: 6,
                      background: pt.changePct >= 0 ? "#E8F5EE" : "#FDECEA",
                      color: pt.changePct >= 0 ? "#1E7A4C" : "#C0392B",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {pt.date.slice(0, 7)} {formatPct(pt.changePct)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {intel.insights.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6B6B62", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Meeting-ready angles
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {intel.insights.map((insight) => (
                  <div key={insight.id} style={{ padding: "12px 14px", borderRadius: 8, background: "#F7F6F3", border: "1px solid #EBE9E4" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1A" }}>
                      {insight.label}: {insight.value}
                    </div>
                    <div style={{ fontSize: 13, color: "#6B6B62", marginTop: 4, lineHeight: 1.5 }}>{insight.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {intel.similarCompetitors.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6B6B62", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Audience-overlap rivals
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
                {intel.similarCompetitors.slice(0, 8).map((peer) => (
                  <div
                    key={peer.domain}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid #EBE9E4",
                      background: "#FFFFFF",
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                    }}
                  >
                    {peer.favicon && (
                      <img src={peer.favicon} alt="" width={20} height={20} style={{ borderRadius: 4, marginTop: 2, flexShrink: 0 }} />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {peer.domain}
                      </div>
                      <div style={{ fontSize: 12, color: "#6B6B62", marginTop: 4 }}>
                        {peer.affinity != null ? `${Math.round(peer.affinity * 100)}% overlap` : "Peer"}
                        {peer.categoryRank != null ? ` · #${peer.categoryRank} ${peer.category ?? "category"}` : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {t?.topAdPublishers && t.topAdPublishers.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6B6B62", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Ad destinations
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {t.topAdPublishers.map((pub) => (
                  <span
                    key={pub}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: "#FDF6E8",
                      border: "1px solid #E8D5A0",
                      color: "#1C1C1A",
                    }}
                  >
                    {pub}
                  </span>
                ))}
              </div>
            </div>
          )}

          {intel.news.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6B6B62", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                News signal
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {intel.news.slice(0, 4).map((article, i) => (
                  <a
                    key={`${article.title}-${i}`}
                    href={article.url ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 13, color: "#1C1C1A", textDecoration: article.url ? "underline" : "none" }}
                  >
                    {article.title}
                    {article.source ? <span style={{ color: "#9E9D94" }}> · {article.source}</span> : null}
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function buyerSafeMessage(message?: string): string | undefined {
  if (!message) return undefined;
  return message
    .replace(/Similarweb/gi, "market signals")
    .replace(/DataForSEO/gi, "channel evidence")
    .replace(/Apify/gi, "creative evidence")
    .replace(/Newspi/gi, "news signal")
    .replace(/RapidAPI key/gi, "API key in Settings");
}

function Metric({
  icon: Icon,
  label,
  value,
  sub,
  delta,
}: {
  icon: typeof Globe;
  label: string;
  value: string;
  sub?: string;
  delta?: number | null;
}) {
  const deltaColor =
    delta == null ? undefined : delta > 0 ? "#1E7A4C" : delta < 0 ? "#C0392B" : "#6B6B62";

  return (
    <div style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid #EBE9E4", background: "#FAFAF8" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#9E9D94", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        <Icon size={13} /> {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "#1C1C1A", marginTop: 8, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 12, color: deltaColor ?? "#6B6B62", marginTop: 4, fontWeight: delta != null ? 600 : 400 }}>
          {sub}
        </div>
      )}
    </div>
  );
}
