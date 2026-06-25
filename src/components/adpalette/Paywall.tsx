import { useState } from "react";
import { toast } from "sonner";
import { Lock, Crosshair, Users, Check, LogOut, ArrowRight } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

type PlanKey = "solo" | "agency";

const PLANS: { key: PlanKey; name: string; price: number; advertisers: string; icon: typeof Crosshair; badge?: string; perks: string[] }[] = [
  { key: "solo", name: "The Solo Sniper", price: 199, advertisers: "1 core tracked advertiser brand", icon: Crosshair,
    perks: ["Daily creative refresh", "Full ad library indexing", "CSV + PDF exports"] },
  { key: "agency", name: "The Agency 7-Pack", price: 799, advertisers: "Up to 7 tracked advertiser brands", icon: Users, badge: "BEST VALUE",
    perks: ["Everything in Solo Sniper", "Side-by-side advertiser benchmarks", "White-label pitch decks", "Hook & creative diff alerts"] },
];

export function Paywall({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<PlanKey>("solo");
  const [busy, setBusy] = useState(false);

  const checkout = async () => {
    setBusy(true);
    try {
      // Live Stripe checkout endpoint — wired once Lovable Payments is enabled
      const res = await fetch("/api/public/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, email }),
      });
      if (!res.ok) throw new Error(`Checkout unavailable (${res.status})`);
      const { url } = (await res.json()) as { url?: string };
      if (url) {
        window.location.href = url;
        return;
      }
      throw new Error("No checkout URL returned");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout unavailable");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink grid place-items-center px-6 py-10">
      <div className="w-full max-w-3xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 mono text-[10px] font-bold px-2 py-1 border-2 border-ink rounded-[3px] bg-primary">
            <Lock size={11} /> WORKSPACE LOCKED — PAYMENT REQUIRED
          </div>
          <h1 className="text-2xl font-bold">Activate your RevenueAd workspace</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="font-semibold text-ink">{email}</span>. Pick a plan to unlock live competitor scans.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {PLANS.map((p) => {
            const Icon = p.icon;
            const active = plan === p.key;
            return (
              <button key={p.key} type="button" onClick={() => setPlan(p.key)}
                className={`relative card-flat p-5 text-left transition ${active ? "bg-primary ring-2 ring-ink ring-offset-2 ring-offset-canvas" : "hover:bg-secondary/50"}`}
                aria-pressed={active}>
                {active && (
                  <div className="absolute top-3 right-3 mono text-[10px] font-bold px-2 py-0.5 border-2 border-ink rounded-[3px] bg-ink text-paper">
                    SELECTED
                  </div>
                )}
                {p.badge && (
                  <div className="absolute -top-3 left-3 mono text-[10px] font-bold px-2 py-1 border-2 border-ink rounded-[3px] bg-ink text-paper">
                    {p.badge}
                  </div>
                )}
                <div className="flex items-center gap-1.5 font-bold"><Icon size={14} /> {p.name}</div>
                <div className="mt-3 mono text-3xl font-bold">${p.price}<span className="text-sm font-normal">/mo</span></div>
                <div className="text-xs mt-1 font-semibold">{p.advertisers}</div>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {p.perks.map((f) => (
                    <li key={f} className="flex items-start gap-1.5"><Check size={14} className="mt-0.5 shrink-0" /> {f}</li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => {
              localStorage.setItem("revenuead_demo_unlocked", "1");
              navigate({ to: "/app/dashboard" });
            }}
            className="btn-flat btn-primary w-full sm:w-auto"
          >
            Continue to demo <ArrowRight size={14} />
          </button>
          <div className="flex items-center justify-center gap-3">
            <button onClick={checkout} disabled={busy} className="btn-flat opacity-80">
              {busy ? "Opening Stripe…" : `Continue to Stripe · $${PLANS.find((p) => p.key === plan)!.price}/mo`}
            </button>
            <button onClick={async () => { await supabase.auth.signOut(); onSignOut(); }} className="btn-flat">
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>

        <p className="text-center mono text-[10px] text-muted-foreground">
          You're on R-AD Demo. Ready for the real thing?
        </p>

      </div>
    </div>
  );
}
