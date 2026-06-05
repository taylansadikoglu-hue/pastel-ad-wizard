import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useTheme } from "./theme";
import {
  ArrowRight, Palette, Check, Sparkles, BarChart3, Film, FileDown, PlayCircle,
} from "lucide-react";

type Brand = { name: string; visible: boolean; budget: number; mix: { search: number; social: number; video: number; programmatic: number } };

const SEED: Brand[] = [
  { name: "Sephora",   visible: true, budget: 70, mix: { search: 30, social: 35, video: 20, programmatic: 15 } },
  { name: "Lululemon", visible: true, budget: 55, mix: { search: 20, social: 45, video: 25, programmatic: 10 } },
];

const CHANNEL_COLORS: Record<string, string> = {
  search: "var(--pastel-peach)",
  social: "var(--pastel-lilac)",
  video: "var(--pastel-sage)",
  programmatic: "var(--pastel-blush)",
};

export function Landing({ onEnter }: { onEnter: () => void }) {
  const { theme, toggle } = useTheme();
  const [brands, setBrands] = useState<Brand[]>(SEED);

  const totals = useMemo(() => {
    const visible = brands.filter((b) => b.visible);
    const sum = (k: keyof Brand["mix"]) =>
      visible.reduce((acc, b) => acc + (b.mix[k] * b.budget) / 100, 0);
    return {
      search: sum("search"), social: sum("social"), video: sum("video"), programmatic: sum("programmatic"),
    };
  }, [brands]);

  const total = totals.search + totals.social + totals.video + totals.programmatic || 1;

  const updateBudget = (i: number, v: number) => {
    const next = [...brands]; next[i] = { ...next[i], budget: v }; setBrands(next);
  };
  const toggleBrand = (i: number) => {
    const next = [...brands]; next[i] = { ...next[i], visible: !next[i].visible }; setBrands(next);
    toast.success(`${next[i].name} ${next[i].visible ? "added to" : "removed from"} mix`);
  };

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {/* Header */}
      <header className="border-b-2 border-ink bg-paper sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 border-2 border-ink rounded-[4px] bg-primary grid place-items-center">
              <span className="mono text-xs font-bold">RA</span>
            </div>
            <span className="font-bold tracking-tight">RevenueAd</span>
            <span className="mono text-[10px] px-1.5 py-0.5 border-2 border-ink rounded-[3px] ml-1">v2.6</span>
          </div>
          <nav className="hidden md:flex items-center gap-5 text-sm font-semibold">
            <a href="#demo" className="hover:underline">Live demo</a>
            <a href="#benefits" className="hover:underline">Why RevenueAd</a>
            <a href="#pricing" className="hover:underline">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={toggle} className="btn-flat">
              <Palette size={14} /> {theme === "dark" ? "Warm Canvas" : "Dark Workstation"}
            </button>
            <button onClick={onEnter} className="btn-flat btn-primary">
              Start tracking <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-14 pb-10 grid lg:grid-cols-[1.05fr_1fr] gap-10 items-start">
        <div>
          <div className="inline-flex items-center gap-2 mono text-[11px] px-2 py-1 border-2 border-ink rounded-[3px] bg-paper shadow-flat-sm">
            <Sparkles size={12} /> CROSS-CHANNEL AD INTELLIGENCE
          </div>
          <h1 className="mt-5 text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight">
            See exactly where your clients' competitors are spending their ad budgets.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-xl">
            RevenueAd tracks, compiles, and future-saves every advertising placement published across Search, YouTube, Meta, TikTok, and Programmatic networks. Beautifully simple competitor analysis built for digital agencies.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#demo" className="btn-flat">
              <PlayCircle size={14} /> Try interactive demo
            </a>
            <button onClick={onEnter} className="btn-flat btn-primary">
              Start tracking now — from $199 <ArrowRight size={14} />
            </button>
          </div>
          <div className="mt-6 flex items-center gap-4 mono text-[11px] text-muted-foreground">
            <span>► 14 channels indexed daily</span>
            <span>► SOC2 · GDPR</span>
            <span>► No credit card to demo</span>
          </div>
        </div>

        {/* Live Demo Workbench */}
        <div id="demo" className="card-flat p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-2.5 h-2.5 rounded-full border border-ink bg-destructive" />
                <span className="w-2.5 h-2.5 rounded-full border border-ink bg-primary" />
                <span className="w-2.5 h-2.5 rounded-full border border-ink bg-pastel-sage" />
              </div>
              <span className="mono text-[11px] font-bold">LIVE DEMO · MEDIA MIX MATRIX</span>
            </div>
            <span className="mono text-[10px] px-1.5 py-0.5 border-2 border-ink rounded-[3px] bg-secondary">CLICK ME</span>
          </div>

          {/* Matrix table */}
          <div className="border-2 border-ink rounded-[4px] overflow-hidden">
            <div className="grid grid-cols-[auto_1fr_auto] gap-3 px-3 py-2 bg-secondary border-b-2 border-ink mono text-[10px] font-bold">
              <span>TRACK</span><span>ADVERTISER</span><span>BUDGET INDEX</span>
            </div>
            {brands.map((b, i) => (
              <div key={b.name} className={`grid grid-cols-[auto_1fr_auto] gap-3 px-3 py-3 items-center ${i ? "border-t-2 border-ink" : ""}`}>
                <button
                  onClick={() => toggleBrand(i)}
                  className={`w-5 h-5 border-2 border-ink rounded-[3px] grid place-items-center ${b.visible ? "bg-primary" : "bg-paper"}`}
                  aria-label={`toggle ${b.name}`}
                >
                  {b.visible && <Check size={13} />}
                </button>
                <div>
                  <div className="font-semibold text-sm">{b.name}</div>
                  <div className="mono text-[10px] text-muted-foreground">{b.name.toLowerCase()}.com</div>
                </div>
                <div className="flex items-center gap-2 w-44">
                  <input
                    type="range" min={10} max={100} value={b.budget}
                    onChange={(e) => updateBudget(i, Number(e.target.value))}
                    className="w-full accent-[color:var(--primary)]"
                  />
                  <span className="mono text-xs font-bold w-10 text-right">${b.budget}k</span>
                </div>
              </div>
            ))}
          </div>

          {/* Stacked bar chart */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="mono text-[11px] font-bold">CROSS-CHANNEL MIX</span>
              <span className="mono text-[10px] text-muted-foreground">{Math.round(total)}k modeled spend</span>
            </div>
            <div className="h-10 border-2 border-ink rounded-[4px] overflow-hidden flex">
              {(["search", "social", "video", "programmatic"] as const).map((k) => {
                const w = (totals[k] / total) * 100;
                return (
                  <div
                    key={k}
                    className="h-full border-r-2 border-ink last:border-r-0 transition-all duration-500 grid place-items-center mono text-[10px] font-bold"
                    style={{ width: `${w}%`, backgroundColor: CHANNEL_COLORS[k] }}
                  >
                    {w > 10 && `${Math.round(w)}%`}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3 mt-2 mono text-[10px]">
              {(["search", "social", "video", "programmatic"] as const).map((k) => (
                <span key={k} className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-ink rounded-[2px]" style={{ backgroundColor: CHANNEL_COLORS[k] }} />
                  {k.toUpperCase()}
                </span>
              ))}
            </div>
          </div>

          <div className="mono text-[11px] text-muted-foreground border-t-2 border-ink pt-3">
            ► Toggle advertisers or drag sliders — the mix recalculates in real time.
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section id="benefits" className="max-w-7xl mx-auto px-6 py-14">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
          <h2 className="text-3xl md:text-4xl font-bold">Three reasons agencies switch to RevenueAd</h2>
          <span className="mono text-[11px] text-muted-foreground">NO JARGON · JUST RESULTS</span>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { Icon: BarChart3, tag: "MEDIA MIX MATRIX", title: "Stop Guessing Budgets.", body: "Our proprietary engine reverse-engineers cross-channel spends. See their exact percentage splits across Search, Social, and Video instantly." },
            { Icon: Film,      tag: "CONTINUOUS INSPIRATION LOOP", title: "Steal Winning Video Hooks.", body: "Watch active video creatives from YouTube, Meta, and TikTok in a unified feed. Filter by ad flight duration to copy the concepts that are driving real market return." },
            { Icon: FileDown,  tag: "1-CLICK PITCH EXPORTER", title: "Win the Retainer.", body: "Convert competitor data profiles into stunning, client-ready pitch decks or CSV sheets in 5 seconds flat." },
          ].map(({ Icon, tag, title, body }) => (
            <div key={tag} className="card-flat p-5">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 border-2 border-ink rounded-[4px] grid place-items-center bg-primary">
                  <Icon size={16} />
                </div>
                <span className="mono text-[10px] px-1.5 py-0.5 border-2 border-ink rounded-[3px]">{tag}</span>
              </div>
              <h3 className="mt-4 text-xl font-bold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing teaser */}
      <section id="pricing" className="max-w-7xl mx-auto px-6 py-14">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-block mono text-[10px] font-bold px-2 py-1 border-2 border-ink rounded-[3px] bg-primary mb-3">
            ★ FOUNDING MEMBER LAUNCH · FIRST 100 AGENCIES ONLY
          </div>
          <h2 className="text-3xl md:text-4xl font-bold">Lifetime grandfathered pricing. Locked in forever.</h2>
          <p className="text-sm text-muted-foreground mt-2">
            <span className="font-semibold text-ink">No contracts. No minimum durations. Cancel anytime.</span> Stripe billed monthly.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-5 mt-8 max-w-4xl mx-auto">
          {[
            { name: "The Solo Sniper", price: 199, sub: "1 core tracked advertiser brand", perks: ["Daily creative refresh", "Full ad library indexing", "CSV + PDF exports"] },
            { name: "The Agency 7-Pack", price: 799, sub: "Up to 7 tracked advertiser brands", badge: "BEST VALUE", perks: ["Everything in Solo Sniper", "Side-by-side advertiser benchmarks", "White-label pitch decks", "Hook & creative diff alerts"] },
          ].map((p) => (
            <div key={p.name} className={`relative card-flat p-5 ${p.badge ? "bg-primary" : ""}`}>
              {p.badge && (
                <div className="absolute -top-3 left-3 mono text-[10px] font-bold px-2 py-1 border-2 border-ink rounded-[3px] bg-ink text-paper">
                  {p.badge}
                </div>
              )}
              <div className="mono text-[10px] font-bold px-1.5 py-0.5 border-2 border-ink rounded-[3px] inline-block bg-paper">
                FOUNDING MEMBER · LIFETIME LOCKED
              </div>
              <div className="font-bold mt-3">{p.name}</div>
              <div className="mt-2 mono text-3xl font-bold">${p.price.toLocaleString()}<span className="text-sm font-normal">/mo</span></div>
              <div className="text-xs font-semibold mt-1">{p.sub}</div>
              <ul className="mt-3 space-y-1.5 text-sm">
                {p.perks.map((f) => <li key={f} className="flex items-start gap-1.5"><Check size={14} className="mt-0.5 shrink-0" /> {f}</li>)}
              </ul>
              <div className="mt-3 mono text-[10px] leading-snug border-t-2 border-ink pt-2">
                Lifetime Grandfathered Founding Member Pricing — Locked In Forever for the First 100 Agencies.
              </div>
              <button onClick={onEnter} className="btn-flat w-full mt-3">
                Claim founding seat <ArrowRight size={14} />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-6 max-w-4xl mx-auto card-flat-sm p-3 text-center mono text-[11px] font-bold uppercase tracking-wide bg-paper">
          ✓ No Contracts · ✓ No Minimum Durations · ✓ Cancel Anytime
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-7xl mx-auto px-6 pb-20">
        <div className="card-flat p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div>
            <h3 className="text-2xl md:text-3xl font-bold">Ready to x-ray every competitor?</h3>
            <p className="text-sm text-muted-foreground mt-1">Backtrack their history. Compile their networks. Future-save the archive.</p>
          </div>
          <button onClick={onEnter} className="btn-flat btn-primary">
            Start tracking now <ArrowRight size={14} />
          </button>
        </div>
      </section>

      <footer className="border-t-2 border-ink bg-paper">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-3 mono text-[11px]">
          <span>© RevenueAd · Cross-channel ad intelligence</span>
          <span>SOC2 type II · GDPR · PCI DSS via Stripe</span>
        </div>
      </footer>
    </div>
  );
}
