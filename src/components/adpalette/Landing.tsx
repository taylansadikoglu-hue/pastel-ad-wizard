import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTheme } from "./theme";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowRight, Palette, Check, Sparkles, ArrowUpRight, ShieldCheck, Flame, Compass,
  X as XIcon, Lock, LogIn, LogOut,
} from "lucide-react";

type Brief = {
  client_name: string | null;
  category: string | null;
  headline: string | null;
  summary: string | null;
  strategic_opening: string | null;
  recommended_action: string | null;
  strongest_threat: string | null;
  emerging_challenger: string | null;
  whitespace_emotion: string | null;
  whitespace_score: number | null;
};

type Confidence = {
  ads_analysed: number | null;
  brands_tracked: number | null;
  trend_points: number | null;
  classification_coverage: number | null;
};

function compactNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

function IntelCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="card-flat p-6 flex flex-col gap-3 min-h-[150px]">
      <div className="flex items-center justify-between">
        <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
        <Icon size={14} className="text-muted-foreground" />
      </div>
      <div className="text-2xl md:text-[28px] font-semibold tracking-tight leading-tight truncate" title={value}>
        {value}
      </div>
      {hint && <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mt-auto">{hint}</div>}
    </div>
  );
}

export function Landing({ onEnter }: { onEnter: () => void }) {
  const { theme, toggle } = useTheme();
  const [signedIn, setSignedIn] = useState(false);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [confidence, setConfidence] = useState<Confidence | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const [b, c] = await Promise.all([
        supabase.from("ra_barbs_client_brief").select("*").limit(1).maybeSingle(),
        supabase.from("ra_barbs_confidence").select("*").limit(1).maybeSingle(),
      ]);
      if (!active) return;
      setBrief((b.data ?? null) as Brief | null);
      setConfidence((c.data ?? null) as Confidence | null);
    })();
    return () => { active = false; };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    toast("Signed out");
  };

  const confidenceValue =
    confidence?.classification_coverage != null
      ? `${Number(confidence.classification_coverage).toFixed(0)}%`
      : "High";
  const confidenceHint = confidence
    ? `${compactNumber(confidence.ads_analysed)} creatives · ${compactNumber(confidence.brands_tracked)} brands`
    : "Live signal coverage";

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {/* Header */}
      <header className="border-b border-ink bg-paper/70 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[10px] bg-primary grid place-items-center">
              <span className="mono text-[10px] font-bold">R-AD</span>
            </div>
            <span className="font-semibold tracking-tight">RevenueAd</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#briefing" className="hover:text-ink transition-colors">Briefing</a>
            <a href="#capabilities" className="hover:text-ink transition-colors">Capabilities</a>
            <a href="#pricing" className="hover:text-ink transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={toggle} className="btn-flat" aria-label="Toggle theme">
              <Palette size={14} />
            </button>
            {signedIn ? (
              <>
                <button onClick={onEnter} className="btn-flat btn-primary">
                  Open workspace <ArrowRight size={14} />
                </button>
                <button onClick={signOut} className="btn-flat" aria-label="Sign out">
                  <LogOut size={14} />
                </button>
              </>
            ) : (
              <>
                <button onClick={onEnter} className="btn-flat">
                  <LogIn size={14} /> Sign in
                </button>
                <button onClick={onEnter} className="btn-flat btn-primary">
                  Get briefing <ArrowRight size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="max-w-6xl mx-auto px-8 pt-24 pb-20">
        <div className="inline-flex items-center gap-2 mono text-[10px] uppercase tracking-widest text-muted-foreground mb-8">
          <Sparkles size={12} /> AI Strategy Platform
        </div>
        <h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-[1.02] max-w-5xl">
          The AI strategist that<br />
          watches your market <span className="text-muted-foreground">24/7.</span>
        </h1>
        <p className="mt-8 text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-3xl font-light">
          RevenueAd reads every competitive move, surfaces the open territory, and tells your team
          exactly what to do next — before the morning meeting.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <button onClick={onEnter} className="btn-flat btn-primary text-base px-5 py-3">
            Read this morning's briefing <ArrowRight size={14} />
          </button>
          <a href="#briefing" className="btn-flat text-base px-5 py-3">
            See it in action <ArrowUpRight size={14} />
          </a>
        </div>

        {/* Strategic intelligence cards */}
        <div className="mt-20 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <IntelCard
            icon={Flame}
            label="Strongest Threat"
            value={brief?.strongest_threat ?? "Tracking competitive pressure"}
            hint="Highest creative + demand index"
          />
          <IntelCard
            icon={ArrowUpRight}
            label="Emerging Challenger"
            value={brief?.emerging_challenger ?? "Detecting accelerating brands"}
            hint="Fastest momentum this week"
          />
          <IntelCard
            icon={Compass}
            label="Strategic Opening"
            value={brief?.whitespace_emotion ?? "Mapping open territory"}
            hint={brief?.whitespace_score != null ? `Opportunity score ${brief.whitespace_score}` : "Underclaimed positioning"}
          />
          <IntelCard
            icon={ShieldCheck}
            label="BARBS Confidence"
            value={confidenceValue}
            hint={confidenceHint}
          />
        </div>
      </section>

      {/* BARBS Briefing */}
      <section id="briefing" className="border-t border-ink bg-paper/40">
        <div className="max-w-6xl mx-auto px-8 py-24 md:py-32">
          <div className="grid lg:grid-cols-[auto_1fr] gap-12 items-start">
            <div className="space-y-2">
              <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">BARBS · Morning Brief</div>
              <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {brief?.client_name ?? "Your brand"} · {brief?.category ?? "Category"}
              </div>
            </div>
            <div>
              <h2 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05] max-w-4xl">
                {brief?.headline ??
                  "Your category leader is widening the gap on emotional positioning. There is a window to take it back."}
              </h2>
              <p className="mt-8 text-lg md:text-xl text-ink/75 leading-relaxed max-w-3xl font-light">
                {brief?.summary ??
                  "BARBS reads every competitor placement, every search signal, and every emotional cue in the market — then writes the briefing your strategy director would write, every morning, without fail."}
              </p>

              <div className="mt-12 grid md:grid-cols-2 gap-10 pt-10 border-t border-ink">
                <div>
                  <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Strategic Opening</div>
                  <p className="text-lg leading-relaxed">
                    {brief?.strategic_opening ??
                      "Underclaimed emotional territory in your category. The leader owns rational benefits; the room is open on belonging."}
                  </p>
                </div>
                <div>
                  <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Recommended Action</div>
                  <p className="text-lg leading-relaxed font-medium">
                    {brief?.recommended_action ??
                      "Test a 7-day creative push leading with belonging cues. Hold spend flat; let positioning do the work."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section id="capabilities" className="max-w-6xl mx-auto px-8 py-24 md:py-32">
        <div className="max-w-2xl mb-16">
          <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">What it does</div>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
            Five questions, answered before you ask them.
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-x-12 gap-y-12">
          {[
            { n: "01", t: "What is happening?", b: "Live read of every competitor placement, search trend, and emotional cue across your category." },
            { n: "02", t: "Who is winning?", b: "Category leaders ranked by creative volume, demand capture, and momentum." },
            { n: "03", t: "What territory is open?", b: "Whitespace mapped by emotion, buyer stage, and offer strategy — scored for opportunity." },
            { n: "04", t: "What should I do next?", b: "Recommended actions written like a senior strategy director would write them." },
          ].map((row) => (
            <div key={row.n} className="border-t border-ink pt-6">
              <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">{row.n}</div>
              <h3 className="text-2xl font-semibold tracking-tight">{row.t}</h3>
              <p className="mt-3 text-base text-muted-foreground leading-relaxed">{row.b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-ink bg-paper/40">
        <div className="max-w-6xl mx-auto px-8 py-24 md:py-32">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">Pricing</div>
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
              Two plans. No contracts.
            </h2>
            <p className="mt-5 text-base text-muted-foreground">Founding member pricing locked in forever for the first 100 operators.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              {
                name: "Solo Sniper",
                price: 199,
                sub: "1 tracked brand",
                perks: ["Daily creative refresh", "Full ad library indexing", "CSV + PDF exports"],
                locked: ["BARBS Morning Brief", "Strategic Advisor"],
              },
              {
                name: "Agency 7-Pack",
                price: 799,
                sub: "Up to 7 tracked brands",
                badge: "Most popular",
                perks: [
                  "Everything in Solo Sniper",
                  "BARBS Morning Brief (live)",
                  "Strategic Advisor recommendations",
                  "Side-by-side advertiser benchmarks",
                  "White-label pitch decks",
                ],
              },
            ].map((p) => (
              <div key={p.name} className="card-flat p-8 relative">
                {p.badge && (
                  <div className="absolute -top-3 left-8 mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full bg-ink text-paper">
                    {p.badge}
                  </div>
                )}
                <div className="font-semibold text-lg tracking-tight">{p.name}</div>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-5xl font-semibold tracking-tight">${p.price}</span>
                  <span className="text-base text-muted-foreground">/mo</span>
                </div>
                <div className="text-sm text-muted-foreground mt-1">{p.sub}</div>
                <ul className="mt-8 space-y-3 text-[15px]">
                  {p.perks.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check size={16} className="mt-0.5 shrink-0 text-muted-foreground" /> {f}
                    </li>
                  ))}
                  {p.locked?.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-muted-foreground">
                      <XIcon size={16} className="mt-0.5 shrink-0" />
                      <span>{f} <Lock size={11} className="inline ml-0.5" /></span>
                    </li>
                  ))}
                </ul>
                <button onClick={onEnter} className="btn-flat btn-primary w-full mt-8 py-3">
                  Claim seat <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-6xl mx-auto px-8 py-24 md:py-32 text-center">
        <h2 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05] max-w-4xl mx-auto">
          The market doesn't sleep.<br />
          <span className="text-muted-foreground">Your strategist shouldn't either.</span>
        </h2>
        <div className="mt-10">
          <button onClick={onEnter} className="btn-flat btn-primary text-base px-6 py-3">
            Start your briefing <ArrowRight size={14} />
          </button>
        </div>
      </section>

      <footer className="border-t border-ink">
        <div className="max-w-6xl mx-auto px-8 py-8 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>© RevenueAd · AI strategy platform</span>
          <span className="mono text-[10px] uppercase tracking-widest">SOC2 · GDPR</span>
        </div>
      </footer>
    </div>
  );
}
