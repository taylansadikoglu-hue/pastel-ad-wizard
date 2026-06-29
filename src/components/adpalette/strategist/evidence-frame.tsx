import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const PRODUCT_SOURCE = "R-AD Signal";

export type EvidenceContext = {
  claim: string;
  sourceTable: string;
  sourceApi?: string | null;
  rowCount: number;
  lastUpdated: string | null;
  dateRange: string | null;
  brands: string[];
  confidence: string;
  calculation: string;
  whySupports: string;
  missing?: string[];
};

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
}

function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3 sm:items-baseline">
      <dt className="dense-label text-neutral-500 shrink-0 sm:w-32">{label}</dt>
      <dd className="text-xs text-neutral-200 leading-relaxed break-words">{value ?? "—"}</dd>
    </div>
  );
}

export function EvidenceMeta({ ctx }: { ctx: EvidenceContext }) {
  return (
    <dl className="space-y-2 rounded-md border border-neutral-800 bg-neutral-900/60 p-3">
      <MetaRow label="Source" value={PRODUCT_SOURCE} />
      <MetaRow label="Source table / API" value={[ctx.sourceTable, ctx.sourceApi].filter(Boolean).join(" · ")} />
      <MetaRow label="Rows used" value={ctx.rowCount.toLocaleString()} />
      <MetaRow label="Last updated" value={fmtTime(ctx.lastUpdated)} />
      <MetaRow label="Date range" value={ctx.dateRange ?? "—"} />
      <MetaRow
        label="Brands included"
        value={ctx.brands.length ? ctx.brands.join(", ") : "—"}
      />
      <MetaRow label="Confidence" value={ctx.confidence} />
    </dl>
  );
}

export function EvidenceBlock({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      <div className="dense-label text-neutral-500">{label}</div>
      <div className="text-xs text-neutral-200 leading-relaxed">{children}</div>
    </section>
  );
}

export function EvidenceMissing({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <section className="space-y-1.5 rounded-md border border-amber-900/50 bg-amber-950/20 p-3">
      <div className="dense-label text-amber-400/90">What is missing</div>
      <ul className="m-0 list-disc space-y-1 pl-4 text-xs text-amber-100/90">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function EvidenceDrawerFrame({
  ctx,
  children,
}: {
  ctx: EvidenceContext;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <EvidenceBlock label="Claim supported">{ctx.claim}</EvidenceBlock>
      <EvidenceMeta ctx={ctx} />
      <EvidenceBlock label="Why this supports the claim">{ctx.whySupports}</EvidenceBlock>
      <EvidenceBlock label="Calculation">{ctx.calculation}</EvidenceBlock>
      {ctx.missing?.length ? <EvidenceMissing items={ctx.missing} /> : null}
      {children}
    </div>
  );
}

export function EvidenceSampleTable({
  label = "Sample records",
  columns,
  rows,
  highlightRow,
  emptyMessage = "No sample rows available for this module.",
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
      <div className="dense-label text-neutral-500">Sample ads</div>
      <ul className="m-0 list-none space-y-1 p-0">
        {links.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-sky-400 hover:underline break-all"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
