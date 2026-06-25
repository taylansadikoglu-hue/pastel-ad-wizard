import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTheme } from "./theme";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowRight, Palette, Check, Sparkles, ArrowUpRight, Wallet, Layers, Clock, Compass,
  Lock, LogIn, LogOut,
} from "lucide-react";

function IntelCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: React.ReactNode;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="card-flat p-6 flex flex-col gap-3 min-h-[150px]">
      <div className="flex items-center justify-between">
        <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
        <Icon size={14} className="text-muted-foreground" />
      </div>
      <div
        className={`text-2xl md:text-[28px] font-semibold tracking-tight leading-tight ${
          accent ? "text-primary" : ""
        }`}
      >
        {value}
      </div>
      {hint && <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mt-auto">{hint}</div>}
    </div>
  );
}


export function Landing({ onEnter }: { onEnter: () => void }) {
  const { toggle } = useTheme();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    toast("Signed out");
  };

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
            <a href="#what-you-get" className="hover:text-ink transition-colors">What you get</a>
            <a href="#how" className="hover:text-ink transition-colors">How it works</a>
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
                  Get brief <ArrowRight size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="max-w-6xl mx-auto px-8 pt-24 pb-20">
        <div className="inline-flex items-center gap-2 mono text-[10px] uppercase tracking-widest text-muted-foreground mb-8">
          <Sparkles size={12} /> Competitive Spend Intelligence
        </div>
        <h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-[1.02] max-w-5xl">
          See exactly where your<br />
          competitors are <span className="text-muted-foreground">spending.</span>
        </h1>
        <p className="mt-8 text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-3xl font-light">
          RevenueAd tracks every paid ad across Meta and Google — showing you spend estimates,
          winning creatives, and where the market opportunity is.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <button onClick={onEnter} className="btn-flat btn-primary text-base px-5 py-3">
            Get your first brief <ArrowRight size={14} />
          </button>
          <a href="#how" className="btn-flat text-base px-5 py-3">
            See it in action <ArrowUpRight size={14} />
          </a>
        </div>

        {/* Spend intelligence cards */}
        <div className="mt-20 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <IntelCard
            icon={Wallet}
            label="Est. Monthly Spend"
            value={
              <div>
                <span style={{ color: "#C9963A", fontSize: 20, letterSpacing: 2 }}>●●●●○</span>
                <div
                  style={{
                    fontSize: 11,
                    color: "#9E9D94",
                    marginTop: 4,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Spend index · High
                </div>
              </div>
            }
            hint="Per tracked competitor · derived from ad frequency"
            accent
          />

          <IntelCard
            icon={Layers}
            label="Active Paid Creatives"
            value="247"
            hint="168 Meta · 79 Google"
          />
          <IntelCard
            icon={Clock}
            label="Longest Running Ad"
            value="142 days"
            hint="The winners stay on air"
          />
          <IntelCard
            icon={Compass}
            label="Market Opportunity"
            value="38%"
            hint="Open territory in category"
          />
        </div>
      </section>

      {/* What you get */}
      <section id="what-you-get" className="border-t border-ink bg-paper/40">
        <div className="max-w-6xl mx-auto px-8 py-24 md:py-32">
          <div className="max-w-2xl mb-16">
            <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">What you get</div>
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
              The intelligence layer behind every paid pitch.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-x-12 gap-y-12">
            {[
              { n: "01", t: "Estimated monthly spend", b: "Per-competitor AUD spend estimates across Meta and Google, refreshed daily." },
              { n: "02", t: "Creatives running 90+ days", b: "The proven winners that survive the test of money. Sorted, surfaced, ready to study." },
              { n: "03", t: "Channel allocation", b: "Where the budget actually flows — Meta vs Google split, by competitor and category." },
              { n: "04", t: "AI insight on every ad", b: "Hook, angle, offer, and emotional pull broken down on every creative in the library." },
              { n: "05", t: "One-click PDF brief", b: "Client-ready pitch deck generated from the live data, with your branding, in seconds." },
            ].map((row) => (
              <div key={row.n} className="border-t border-ink pt-6">
                <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">{row.n}</div>
                <h3 className="text-2xl font-semibold tracking-tight">{row.t}</h3>
                <p className="mt-3 text-base text-muted-foreground leading-relaxed">{row.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-6xl mx-auto px-8 py-24 md:py-32">
        <div className="max-w-2xl mb-16">
          <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">How it works</div>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
            From domain to client-ready brief in three steps.
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { n: "1", t: "Add a competitor domain", b: "Paste the URL. We pull every active paid ad across Meta and Google in minutes." },
            { n: "2", t: "See where the budget flows", b: "Spend estimates, Meta vs Google breakdown, longest-running winners — all in one view." },
            { n: "3", t: "Export a client-ready PDF", b: "One click. A polished, branded brief ready to send to your client or pitch room." },
          ].map((s) => (
            <div key={s.n} className="card-flat p-8">
              <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">Step {s.n}</div>
              <h3 className="text-2xl font-semibold tracking-tight">{s.t}</h3>
              <p className="mt-3 text-base text-muted-foreground leading-relaxed">{s.b}</p>
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
              Three plans. No contracts.
            </h2>
            <p className="mt-5 text-base text-muted-foreground">Cancel any time. White-label is for agencies pitching as their own.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {[
              {
                name: "Solo Sniper",
                price: "$199",
                sub: "1 competitor tracked",
                perks: ["Daily creative refresh", "Spend estimates", "PDF brief export"],
                cta: "Claim seat",
                action: "enter" as const,
              },
              {
                name: "Agency 7-Pack",
                price: "$799",
                sub: "Up to 7 competitors tracked",
                badge: "Best value",
                perks: [
                  "Everything in Solo Sniper",
                  "Side-by-side competitor benchmarks",
                  "Channel allocation breakdown",
                  "Longest-running creative leaderboards",
                  "Priority data refresh",
                ],
                cta: "Claim seat",
                action: "enter" as const,
              },
              {
                name: "Enterprise White Label",
                price: "$2,999",
                sub: "Unlimited competitors",
                perks: [
                  "Everything in Agency 7-Pack",
                  "Your agency branding on every PDF",
                  "Custom domain reporting",
                  "Dedicated onboarding",
                  "SLA + priority support",
                ],
                cta: "Talk to us",
                action: "mail" as const,
              },
            ].map((p) => (
              <div key={p.name} className="card-flat p-8 relative">
                {p.badge && (
                  <div className="absolute -top-3 left-8 mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full bg-primary text-ink">
                    {p.badge}
                  </div>
                )}
                <div className="font-semibold text-lg tracking-tight">{p.name}</div>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-5xl font-semibold tracking-tight">{p.price}</span>
                  <span className="text-base text-muted-foreground">/mo</span>
                </div>
                <div className="text-sm text-muted-foreground mt-1">{p.sub}</div>
                <ul className="mt-8 space-y-3 text-[15px]">
                  {p.perks.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check size={16} className="mt-0.5 shrink-0 text-muted-foreground" /> {f}
                    </li>
                  ))}
                </ul>
                {p.action === "mail" ? (
                  <a
                    href="mailto:hello@revenuad.com"
                    className="btn-flat btn-primary w-full mt-8 py-3 justify-center"
                  >
                    {p.cta} <ArrowRight size={14} />
                  </a>
                ) : (
                  <button onClick={onEnter} className="btn-flat btn-primary w-full mt-8 py-3">
                    {p.cta} <ArrowRight size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-6xl mx-auto px-8 py-24 md:py-32 text-center">
        <h2 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05] max-w-4xl mx-auto">
          Stop guessing what works.<br />
          <span className="text-muted-foreground">See where the money actually goes.</span>
        </h2>
        <div className="mt-10">
          <button onClick={onEnter} className="btn-flat btn-primary text-base px-6 py-3">
            Get your first brief <ArrowRight size={14} />
          </button>
        </div>
      </section>

      <footer className="border-t border-ink">
        <div className="max-w-6xl mx-auto px-8 py-8 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>© RevenueAd · Competitive spend intelligence</span>
          <span className="mono text-[10px] uppercase tracking-widest">SOC2 · GDPR</span>
        </div>
      </footer>
    </div>
  );
}
