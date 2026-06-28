import { useState } from "react";
import { toast } from "sonner";
import { Lock, LogOut, ArrowRight, Building2, Users, Crown } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PRICING_ADDONS, PRICING_PLANS, type PlanKey } from "@/lib/pricing-plans";

const PLAN_ICONS = {
  launch: Building2,
  growth: Users,
  pro: Crown,
} as const;

export function Paywall({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<PlanKey>("growth");
  const [busy, setBusy] = useState(false);
  const selected = PRICING_PLANS.find((p) => p.key === plan)!;

  const checkout = async () => {
    setBusy(true);
    try {
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
      <div className="w-full max-w-5xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 mono text-[10px] font-bold px-2 py-1 border-2 border-ink rounded-[3px] bg-primary">
            <Lock size={11} /> AGENCY WORKSPACE — CHOOSE A PLAN
          </div>
          <h1 className="text-2xl font-bold">Activate your R-AD agency account</h1>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            Signed in as <span className="font-semibold text-ink">{email}</span>.
            Agency accounts hold multiple <span className="font-semibold text-ink">client workspaces</span> — each with its own competitors, category, and pitch context.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {PRICING_PLANS.map((p) => {
            const Icon = PLAN_ICONS[p.key];
            const active = plan === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setPlan(p.key)}
                className={`relative card-flat p-5 text-left transition ${active ? "bg-primary ring-2 ring-ink ring-offset-2 ring-offset-canvas" : "hover:bg-secondary/50"}`}
                aria-pressed={active}
              >
                {p.badge && (
                  <div className="absolute -top-3 left-3 mono text-[10px] font-bold px-2 py-1 border-2 border-ink rounded-[3px] bg-ink text-paper">
                    {p.badge}
                  </div>
                )}
                <div className="flex items-center gap-1.5 font-bold">
                  <Icon size={14} /> {p.name}
                </div>
                <div className="mt-3 mono text-3xl font-bold">
                  ${p.price.toLocaleString()}
                  <span className="text-sm font-normal">/mo</span>
                </div>
                <div className="text-xs mt-2 font-semibold">{p.workspaces}</div>
                <div className="text-xs mt-1 text-muted-foreground">{p.categories}</div>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {p.perks.map((f) => (
                    <li key={f} className="leading-snug">{f}</li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        <div className="card-flat-sm p-4 mono text-[11px] space-y-1 text-muted-foreground">
          <div className="font-bold text-ink uppercase tracking-wide text-[10px]">Add-ons</div>
          {PRICING_ADDONS.map((a) => (
            <div key={a.label} className="flex justify-between gap-4">
              <span>{a.label}</span>
              <span className="font-semibold text-ink">+${a.price}/mo</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => {
              localStorage.setItem("revenuead_demo_unlocked", "1");
              navigate({ to: "/app/clients" });
            }}
            className="btn-flat btn-primary w-full sm:w-auto"
          >
            Continue to demo <ArrowRight size={14} />
          </button>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button onClick={checkout} disabled={busy} className="btn-flat opacity-80">
              {busy ? "Opening Stripe…" : `Continue to Stripe · $${selected.price}/mo`}
            </button>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                onSignOut();
              }}
              className="btn-flat"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>

        <p className="text-center mono text-[10px] text-muted-foreground">
          Launch categories: Banking · Retail · Insurance · Telco. Locked categories visible with upgrade in-app.
        </p>
      </div>
    </div>
  );
}
