import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Globe, Newspaper, Radar, Megaphone } from "lucide-react";
import { loadDomainIntelligence } from "@/lib/domain-intelligence.functions";
import type { DomainIntelligence, FeedSource } from "@/lib/feeds/types";
import { formatCurrency, formatVisits } from "@/lib/feeds/normalize-domain";

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
            Observed market signals
          </div>
          <div style={{ fontSize: 13, color: "#6B6B62", marginTop: 4 }}>
            Traffic, channel activity, peers, and news — unified for pitch-ready context.
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
              value={formatVisits(intel.traffic?.monthlyVisits)}
              sub={intel.traffic?.title ?? intel.traffic?.category ?? "Observed market signals"}
            />
            <Metric
              icon={Radar}
              label="Global rank"
              value={intel.traffic?.globalRank ? `#${intel.traffic.globalRank}` : intel.traffic?.categoryRank ? `Cat #${intel.traffic.categoryRank}` : "—"}
              sub={
                [
                  intel.traffic?.category?.split(">").pop()?.trim(),
                  intel.traffic?.topCountry ? `${intel.traffic.topCountry} #${intel.traffic.topCountryRank ?? "—"}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || undefined
              }
            />
            <Metric
              icon={Megaphone}
              label="Est. paid spend"
              value={formatCurrency(intel.paidMedia?.estimatedMonthlySpend)}
              sub={`${intel.paidMedia?.creativeCount ?? 0} placements tracked`}
            />
            <Metric icon={Newspaper} label="News headlines" value={String(intel.news.length)} sub="News signal" />
          </div>

          {intel.insights.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6B6B62", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Meeting-ready reads
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {intel.insights.map((insight) => (
                  <div key={insight.id} style={{ padding: "12px 14px", borderRadius: 8, background: "#F7F6F3", border: "1px solid #EBE9E4" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1A" }}>{insight.label}: {insight.value}</div>
                    <div style={{ fontSize: 13, color: "#6B6B62", marginTop: 4, lineHeight: 1.5 }}>{insight.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {intel.similarCompetitors.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6B6B62", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Audience-overlap peers
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                {intel.similarCompetitors.slice(0, 8).map((peer) => (
                  <div key={peer.domain} style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #EBE9E4", background: "#FFFFFF", display: "flex", gap: 10, alignItems: "flex-start" }}>
                    {peer.favicon && (
                      <img src={peer.favicon} alt="" width={20} height={20} style={{ borderRadius: 4, marginTop: 2, flexShrink: 0 }} />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {peer.title ?? peer.domain}
                      </div>
                      <div style={{ fontSize: 12, color: "#6B6B62", marginTop: 2 }}>{peer.domain}</div>
                      <div style={{ fontSize: 12, color: "#9E9D94", marginTop: 4 }}>
                        {formatVisits(peer.monthlyVisits)} visits
                        {peer.globalRank != null ? ` · #${peer.globalRank} global` : ""}
                        {peer.categoryRank != null ? ` · cat #${peer.categoryRank}` : ""}
                      </div>
                    </div>
                  </div>
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
}: {
  icon: typeof Globe;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid #EBE9E4", background: "#FAFAF8" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#9E9D94", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        <Icon size={13} /> {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "#1C1C1A", marginTop: 8 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#6B6B62", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
