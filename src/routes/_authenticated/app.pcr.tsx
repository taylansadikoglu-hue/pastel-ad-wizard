import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Award,
  DollarSign,
  Lightbulb,
} from "lucide-react";
import { WorkspaceShell } from "@/components/adpalette/WorkspaceShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type KPI = { label: string; goal: number; actual: number; unit?: string };

const KPIS: KPI[] = [
  { label: "Revenue", goal: 1_200_000, actual: 1_384_000, unit: "$" },
  { label: "New Customers", goal: 4500, actual: 5210 },
  { label: "ROAS", goal: 3.2, actual: 3.9, unit: "x" },
  { label: "CAC", goal: 42, actual: 38, unit: "$" },
];

const GROWTH = {
  revenue: { current: 1_384_000, prevMonth: 1_180_000, prevYear: 940_000 },
  customers: { current: 5210, prevMonth: 4480, prevYear: 3220 },
};

const PAID = [
  { ch: "Meta", impr: 8_420_000, clicks: 142_300, cpc: 0.82, ctr: 1.69, cpa: 32.1, roas: 4.2 },
  { ch: "Google", impr: 5_120_000, clicks: 98_400, cpc: 1.41, ctr: 1.92, cpa: 41.0, roas: 3.6 },
  { ch: "TikTok", impr: 6_840_000, clicks: 121_800, cpc: 0.64, ctr: 1.78, cpa: 36.5, roas: 3.1 },
];

const EARNED = [
  { outlet: "TechCrunch", tier: "Tier 1", mentions: 3, reach: 4_200_000, sentiment: "Positive", sov: 18 },
  { outlet: "Vogue Business", tier: "Tier 1", mentions: 2, reach: 1_900_000, sentiment: "Positive", sov: 12 },
  { outlet: "Modern Retail", tier: "Tier 2", mentions: 5, reach: 480_000, sentiment: "Neutral", sov: 9 },
];

const SOCIAL = [
  { net: "Instagram", followers: 142_000, growth: 8.4, eng: 4.1, likes: 312_400, shares: 18_200, comments: 22_100, conv: 1840 },
  { net: "TikTok", followers: 96_500, growth: 22.6, eng: 7.3, likes: 902_100, shares: 64_900, comments: 41_300, conv: 3120 },
  { net: "LinkedIn", followers: 28_400, growth: 3.2, eng: 2.4, likes: 18_900, shares: 2_840, comments: 1_640, conv: 410 },
];

function pct(curr: number, prev: number) {
  return ((curr - prev) / prev) * 100;
}

function fmt(n: number, unit?: string) {
  if (unit === "$") return `$${n.toLocaleString()}`;
  if (unit === "x") return `${n.toFixed(1)}x`;
  return n.toLocaleString();
}

function KPICard({ kpi }: { kpi: KPI }) {
  const delta = ((kpi.actual - kpi.goal) / kpi.goal) * 100;
  const hit = kpi.actual >= kpi.goal;
  return (
    <div className="card-flat p-4">
      <div className="mono text-[10px] uppercase text-muted-foreground">{kpi.label}</div>
      <div className="text-2xl font-bold mt-1">{fmt(kpi.actual, kpi.unit)}</div>
      <div className="text-[11px] mono text-muted-foreground mt-1">
        Goal: {fmt(kpi.goal, kpi.unit)}
      </div>
      <div
        className={`mt-2 inline-flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 border-2 border-ink rounded-[3px] ${
          hit ? "bg-green-100 dark:bg-green-900/40" : "bg-red-100 dark:bg-red-900/40"
        }`}
      >
        {hit ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
        {delta >= 0 ? "+" : ""}
        {delta.toFixed(1)}% vs goal
      </div>
    </div>
  );
}

function GrowthBlock({
  label,
  current,
  prevMonth,
  prevYear,
  unit,
}: {
  label: string;
  current: number;
  prevMonth: number;
  prevYear: number;
  unit?: string;
}) {
  const mom = pct(current, prevMonth);
  const yoy = pct(current, prevYear);
  return (
    <div className="card-flat p-5">
      <div className="mono text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="text-3xl font-bold mt-1">{fmt(current, unit)}</div>
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="border-2 border-ink rounded-[4px] p-3 bg-secondary">
          <div className="mono text-[10px] uppercase">MoM</div>
          <div className={`text-xl font-bold ${mom >= 0 ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>
            {mom >= 0 ? "+" : ""}{mom.toFixed(1)}%
          </div>
          <div className="mono text-[9px] text-muted-foreground mt-1">
            ((C − P) / P) × 100
          </div>
        </div>
        <div className="border-2 border-ink rounded-[4px] p-3 bg-secondary">
          <div className="mono text-[10px] uppercase">YoY</div>
          <div className={`text-xl font-bold ${yoy >= 0 ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>
            {yoy >= 0 ? "+" : ""}{yoy.toFixed(1)}%
          </div>
          <div className="mono text-[9px] text-muted-foreground mt-1">
            ((C − PY) / PY) × 100
          </div>
        </div>
      </div>
    </div>
  );
}

function PCRPage() {
  const [tab, setTab] = useState("paid");

  return (
    <WorkspaceShell
      title="Post-Campaign Report"
      subtitle="Executive summary, comparative growth, channel tactics, and post-implementation review."
    >
      <div className="space-y-8">
        {/* Section 1 */}
        <section>
          <div className="mono text-[10px] uppercase text-muted-foreground mb-2">
            01 · Executive Summary & Strategy
          </div>
          <div className="card-flat p-5 mb-4">
            <div className="flex items-start gap-3">
              <Award size={20} />
              <div>
                <div className="font-bold">60-Second Big Picture Summary</div>
                <p className="text-sm text-muted-foreground mt-1">
                  Campaign exceeded all four primary KPIs. Revenue +15.3% vs goal,
                  driven by stronger-than-modeled TikTok performance and a Tier-1
                  earned-media halo. CAC came in 9.5% under target while ROAS
                  cleared the 3.2x threshold and landed at 3.9x.
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {KPIS.map((k) => (
              <KPICard key={k.label} kpi={k} />
            ))}
          </div>
          <div className="border-2 border-ink rounded-[4px] p-4 bg-primary text-ink shadow-flat-sm">
            <div className="mono text-[10px] uppercase font-bold">Strategic Verdict</div>
            <div className="text-lg font-bold mt-1">
              ✅ All primary goals met. Reallocate budget toward TikTok + Tier-1 PR for next cycle.
            </div>
          </div>
        </section>

        {/* Section 2 */}
        <section>
          <div className="mono text-[10px] uppercase text-muted-foreground mb-2">
            02 · Comparative Growth Engine
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <GrowthBlock
              label="Revenue"
              current={GROWTH.revenue.current}
              prevMonth={GROWTH.revenue.prevMonth}
              prevYear={GROWTH.revenue.prevYear}
              unit="$"
            />
            <GrowthBlock
              label="New Customers"
              current={GROWTH.customers.current}
              prevMonth={GROWTH.customers.prevMonth}
              prevYear={GROWTH.customers.prevYear}
            />
          </div>
        </section>

        {/* Section 3 */}
        <section>
          <div className="mono text-[10px] uppercase text-muted-foreground mb-2">
            03 · Granular Channel Tactics Matrix
          </div>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="paid">Paid</TabsTrigger>
              <TabsTrigger value="earned">Earned / PR</TabsTrigger>
              <TabsTrigger value="organic">Organic / Social</TabsTrigger>
            </TabsList>
            <TabsContent value="paid">
              <div className="card-flat overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary border-b-2 border-ink">
                    <tr>
                      {["Channel", "Impr.", "Clicks", "CPC", "CTR", "CPA", "ROAS"].map((h) => (
                        <th key={h} className="text-left px-3 py-2 mono text-[10px] uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PAID.map((r) => (
                      <tr key={r.ch} className="border-b border-ink/20">
                        <td className="px-3 py-2 font-bold">{r.ch}</td>
                        <td className="px-3 py-2">{r.impr.toLocaleString()}</td>
                        <td className="px-3 py-2">{r.clicks.toLocaleString()}</td>
                        <td className="px-3 py-2">${r.cpc.toFixed(2)}</td>
                        <td className="px-3 py-2">{r.ctr.toFixed(2)}%</td>
                        <td className="px-3 py-2">${r.cpa.toFixed(2)}</td>
                        <td className="px-3 py-2 font-bold">{r.roas.toFixed(1)}x</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
            <TabsContent value="earned">
              <div className="card-flat overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary border-b-2 border-ink">
                    <tr>
                      {["Outlet", "Tier", "Mentions", "Reach", "Sentiment", "SOV"].map((h) => (
                        <th key={h} className="text-left px-3 py-2 mono text-[10px] uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {EARNED.map((r) => (
                      <tr key={r.outlet} className="border-b border-ink/20">
                        <td className="px-3 py-2 font-bold">{r.outlet}</td>
                        <td className="px-3 py-2">{r.tier}</td>
                        <td className="px-3 py-2">{r.mentions}</td>
                        <td className="px-3 py-2">{r.reach.toLocaleString()}</td>
                        <td className="px-3 py-2">{r.sentiment}</td>
                        <td className="px-3 py-2 font-bold">{r.sov}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
            <TabsContent value="organic">
              <div className="card-flat overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary border-b-2 border-ink">
                    <tr>
                      {["Network", "Followers", "Growth", "Eng%", "Likes", "Shares", "Comments", "Conv."].map((h) => (
                        <th key={h} className="text-left px-3 py-2 mono text-[10px] uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SOCIAL.map((r) => (
                      <tr key={r.net} className="border-b border-ink/20">
                        <td className="px-3 py-2 font-bold">{r.net}</td>
                        <td className="px-3 py-2">{r.followers.toLocaleString()}</td>
                        <td className="px-3 py-2 text-green-700 dark:text-green-300 font-bold">+{r.growth}%</td>
                        <td className="px-3 py-2">{r.eng}%</td>
                        <td className="px-3 py-2">{r.likes.toLocaleString()}</td>
                        <td className="px-3 py-2">{r.shares.toLocaleString()}</td>
                        <td className="px-3 py-2">{r.comments.toLocaleString()}</td>
                        <td className="px-3 py-2 font-bold">{r.conv.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </section>

        {/* Section 4 */}
        <section>
          <div className="mono text-[10px] uppercase text-muted-foreground mb-2">
            04 · Post-Implementation Review (PIR)
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="card-flat p-4">
              <div className="flex items-center gap-2 font-bold">
                <DollarSign size={16} /> Budget & Delivery
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                <li>• Planned spend: $480,000</li>
                <li>• Actual spend: $462,800 (96.4% delivered)</li>
                <li>• Pacing: on-track weeks 1–5, accelerated weeks 6–8</li>
                <li>• Underspend: $17,200 (rolling to next cycle)</li>
              </ul>
            </div>
            <div className="card-flat p-4">
              <div className="flex items-center gap-2 font-bold">
                <Target size={16} /> Targeting & Creative ROI
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                <li>• Top audience: 25–34 F, urban (ROAS 4.8x)</li>
                <li>• Top creative: UGC unboxing (CTR 2.4%)</li>
                <li>• Lowest ROI: static carousel (ROAS 1.9x)</li>
                <li>• Best hook: founder-led story</li>
              </ul>
            </div>
            <div className="card-flat p-4 bg-secondary">
              <div className="flex items-center gap-2 font-bold">
                <Lightbulb size={16} /> Next Steps — Pitch
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                <li>• Shift +20% budget from Google → TikTok</li>
                <li>• Double UGC creative production (8 → 16/wk)</li>
                <li>• Add Tier-1 PR retainer (target Vogue, TC)</li>
                <li>• Sunset static carousels by Q3</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </WorkspaceShell>
  );
}

export const Route = createFileRoute("/_authenticated/app/pcr")({
  head: () => ({ meta: [{ title: "PCR Reporting — RevenueAd" }] }),
  component: PCRPage,
});
