import type { ReactNode } from "react";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CreativeProofCard } from "@/lib/evidence/creative-proof";
import type { MarketSignalView } from "@/lib/evidence/market-signal";
import { displayBrand } from "@/utils/brandDisplay";

export type EvidenceContext = {
  claim: string;
  confidence: string;
  dateRange: string | null;
  basedOn: string[];
  whySupports: string;
  methodology: string;
  creativeCount?: number;
  brandCount?: number;
  /** Internal — not rendered in customer UI */
  sourceTable?: string;
  sourceApi?: string | null;
  rowCount?: number;
  lastUpdated?: string | null;
  brands?: string[];
  missing?: string[];
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function ConfidenceBadge({ level }: { level: string }) {
  const v = level.toLowerCase();
  const style =
    v === "high"
      ? "bg-emerald-950/50 text-emerald-300 border-emerald-800"
      : v === "medium"
        ? "bg-amber-950/40 text-amber-200 border-amber-800"
        : "bg-neutral-900 text-neutral-400 border-neutral-700";
  return (
    <span className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full border", style)}>
      Confidence: {level}
    </span>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{children}</div>
  );
}

export function CreativeProofGrid({
  cards,
  emptyMessage = "Creative proof is still being collected for this claim.",
}: {
  cards: CreativeProofCard[];
  emptyMessage?: string;
}) {
  if (!cards.length) {
    return <p className="text-xs text-neutral-500 m-0 leading-relaxed">{emptyMessage}</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map((card) => (
        <article
          key={card.id}
          className="rounded-lg border border-neutral-800 bg-neutral-900/80 overflow-hidden flex flex-col"
        >
          {card.thumbnailUrl ? (
            <div className="aspect-video bg-neutral-950 border-b border-neutral-800 overflow-hidden">
              {card.format === "video" ? (
                <video
                  src={card.thumbnailUrl}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                <img src={card.thumbnailUrl} alt="" className="w-full h-full object-cover" />
              )}
            </div>
          ) : (
            <div className="aspect-video bg-neutral-950 border-b border-neutral-800 flex items-center justify-center text-[11px] text-neutral-600">
              No preview
            </div>
          )}
          <div className="p-3 flex flex-col gap-2 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-neutral-100 truncate">
                  {displayBrand(card.advertiser)}
                </div>
                <div className="text-[11px] text-neutral-500">
                  {[card.platform, card.format !== "unknown" ? card.format : null].filter(Boolean).join(" · ") ||
                    "Observed creative"}
                </div>
              </div>
            </div>
            {card.headline && (
              <p className="text-xs font-medium text-neutral-200 m-0 line-clamp-2">{card.headline}</p>
            )}
            {card.body && <p className="text-[11px] text-neutral-400 m-0 line-clamp-2">{card.body}</p>}
            {card.cta && (
              <div className="text-[11px] text-amber-400/90 font-medium">CTA: {card.cta}</div>
            )}
            <div className="flex flex-wrap gap-1.5 mt-auto">
              {card.emotionalDriver && (
                <Tag label={card.emotionalDriver} />
              )}
              {card.offerType && <Tag label={card.offerType} />}
              {card.buyerStage && <Tag label={card.buyerStage} />}
              {card.productType && <Tag label={card.productType} />}
            </div>
            <div className="text-[10px] text-neutral-500 pt-1 border-t border-neutral-800/80">
              {card.runningDays != null && <span>{card.runningDays}d running · </span>}
              <span>Seen {fmtDate(card.firstSeen)} – {fmtDate(card.lastSeen)}</span>
            </div>
            <p className="text-[11px] text-neutral-400 m-0 italic leading-relaxed">{card.whySupports}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300">
      {label}
    </span>
  );
}

export function MarketSignalBlock({ signal }: { signal: MarketSignalView }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3 space-y-1.5">
      <div className="text-sm font-semibold text-neutral-100">{signal.movement}</div>
      <div className="text-xs text-neutral-300">{signal.detail}</div>
      {signal.categoryPosition && (
        <div className="text-[11px] text-neutral-500">Category: {signal.categoryPosition}</div>
      )}
      {signal.searchMix && (
        <div className="text-[11px] text-neutral-500">Search demand: {signal.searchMix}</div>
      )}
    </div>
  );
}

function CollapsibleDetails({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 hover:text-neutral-300"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {title}
      </button>
      {open ? children : null}
    </section>
  );
}

export type EvidenceDrawerExtras = {
  creatives?: CreativeProofCard[];
  marketSignal?: MarketSignalView | null;
  creativesLoading?: boolean;
};

export function EvidenceDrawerFrame({
  ctx,
  extras,
  children,
}: {
  ctx: EvidenceContext;
  extras?: EvidenceDrawerExtras;
  children?: ReactNode;
}) {
  const basedOn = ctx.basedOn.length
    ? ctx.basedOn
    : [
        ctx.creativeCount != null ? `${ctx.creativeCount} creatives observed` : null,
        ctx.brandCount != null ? `${ctx.brandCount} brands in scope` : null,
        ctx.dateRange,
      ].filter(Boolean) as string[];

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <SectionTitle>Why we think this</SectionTitle>
        <p className="text-sm text-neutral-100 font-medium leading-relaxed m-0">{ctx.claim}</p>
        <ConfidenceBadge level={ctx.confidence} />
      </section>

      {basedOn.length > 0 && (
        <section className="space-y-2">
          <SectionTitle>Based on</SectionTitle>
          <ul className="m-0 pl-4 space-y-1 text-xs text-neutral-300">
            {basedOn.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <SectionTitle>Creative proof</SectionTitle>
        {extras?.creativesLoading ? (
          <p className="text-xs text-neutral-500 m-0">Loading observed creatives…</p>
        ) : (
          <CreativeProofGrid cards={extras?.creatives ?? []} />
        )}
      </section>

      {extras?.marketSignal && (
        <section className="space-y-2">
          <SectionTitle>Market signals</SectionTitle>
          <MarketSignalBlock signal={extras.marketSignal} />
        </section>
      )}

      <section className="space-y-2">
        <SectionTitle>Methodology</SectionTitle>
        <p className="text-xs text-neutral-400 m-0 leading-relaxed">{ctx.methodology}</p>
        <p className="text-xs text-neutral-500 m-0 leading-relaxed">{ctx.whySupports}</p>
      </section>

      {children ? (
        <CollapsibleDetails title="Detailed metrics">
          <div className="space-y-3 pt-1">{children}</div>
        </CollapsibleDetails>
      ) : null}
    </div>
  );
}

export function EvidenceSampleTable({
  label = "Records",
  columns,
  rows,
  highlightRow,
  emptyMessage = "No detailed rows for this claim.",
}: {
  label?: string;
  columns: string[];
  rows: (string | number | null)[][];
  highlightRow?: number;
  emptyMessage?: string;
}) {
  return (
    <section className="space-y-2">
      <div className={cn("dense-label text-neutral-500")}>{label}</div>
      {rows.length ? (
        <div className="overflow-x-auto border border-neutral-800 rounded-md">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-neutral-950">
                {columns.map((c) => (
                  <th key={c} className="dense-label py-1.5 px-2 border-b border-neutral-800 text-neutral-500">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={highlightRow === i ? "bg-neutral-800/40" : "bg-neutral-900/50"}>
                  {row.map((cell, j) => (
                    <td key={j} className="py-1.5 px-2 border-b border-neutral-800/60 text-neutral-300 tabular-nums">
                      {cell ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-neutral-500 m-0">{emptyMessage}</p>
      )}
    </section>
  );
}

export function EvidenceSampleLinks({ links }: { links: { label: string; href: string }[] }) {
  if (!links.length) return null;
  return (
    <section className="space-y-2">
      <div className="dense-label text-neutral-500">Related</div>
      <ul className="m-0 list-none space-y-1 p-0">
        {links.map((link) => (
          <li key={link.href}>
            <a href={link.href} className="text-xs text-sky-400 hover:underline break-all">
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** @deprecated Internal meta block — not shown in customer evidence UI */
export function EvidenceMeta() {
  return null;
}
