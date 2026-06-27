import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useTheme } from "./theme";
import { saveProfile } from "@/lib/integrations.functions";
import { startScan } from "@/lib/scan.functions";
import {
  ArrowRight, ArrowLeft, Check, CreditCard, Lock, Loader2, Palette, Building2, Users, Crown,
} from "lucide-react";
import { PRICING_PLANS, type PlanKey } from "@/lib/pricing-plans";

const STEPS = ["Sign up", "Agency", "Client workspace", "Plan", "Sync"];

const FOCUS_OPTIONS = [
  "Performance Creative (Meta/TikTok heavy)",
  "High-Intent Search (Google PPC heavy)",
  "Omnichannel Brand Mix",
];

type PlanKeyLocal = PlanKey;

const PLAN_ICONS = { launch: Building2, growth: Users, pro: Crown } as const;

export function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const { theme, toggle } = useTheme();
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    fullName: "", email: "", password: "",
    agency: "", focus: FOCUS_OPTIONS[0],
    rivals: ["", "", ""],
    countries: ["United States", "United States", "United States"],
    plan: "growth" as PlanKeyLocal,
    card: "", cardName: "", exp: "", cvc: "",
  });
  const [syncProgress, setSyncProgress] = useState(0);

  const next = () => {
    if (step === 0 && (!data.fullName || !data.email || !data.password)) {
      toast.error("Please complete all fields"); return;
    }
    if (step === 1 && !data.agency) { toast.error("Agency name required"); return; }
    if (step === 2 && data.rivals.filter(Boolean).length < 3) {
      toast.error("Enter all 3 advertiser domains"); return;
    }
    if (step === 3) {
      if (!data.card || !data.cardName || !data.exp || !data.cvc) {
        toast.error("Complete payment details"); return;
      }
      const plan = PRICING_PLANS.find((p) => p.key === data.plan)!;
      toast.success(`${plan.name} plan selected`);
    }
    if (step === 4) { onComplete(); return; }
    if (step === 3) {
      setStep(4);
      // Fire real backend: save profile + trigger live scan for each entered domain
      (async () => {
        try {
          const entries = data.rivals
            .map((d: string, i: number) => ({ domain: (d || "").trim(), country: data.countries[i] || "United States" }))
            .filter((e) => e.domain);
          const domains = entries.map((e) => e.domain);
          await saveProfile({ data: { agency_name: data.agency || "My Agency", agency_domain: domains[0] ?? null } });
          await Promise.all(entries.map((e) => startScan({ data: { domain: e.domain, country: e.country as "United States" | "Australia" | "United Kingdom" | "Canada" } }).catch((err) => console.error("scan", e.domain, err))));
        } catch (e) {
          console.error(e);
          toast.error("Couldn't kick off scans — check Developer Integrations.");
        }
      })();
      const iv = setInterval(() => {
        setSyncProgress((p) => {
          if (p >= 100) { clearInterval(iv); return 100; }
          return p + 7;
        });
      }, 220);
      return;
    }
    setStep((s) => s + 1);

  };

  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b-2 border-ink bg-paper">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="px-1.5 h-7 border-2 border-ink rounded-[4px] bg-primary grid place-items-center">
              <span className="mono text-[10px] font-bold">R-AD</span>
            </div>
            <span className="font-bold tracking-tight">RevenuAD Signal</span>
            <span className="mono text-[10px] px-1.5 py-0.5 border-2 border-ink rounded-[3px] ml-1">v2.6</span>
          </div>
          <button onClick={toggle} className="btn-flat">
            <Palette size={14} /> {theme === "dark" ? "Warm Canvas Mode" : "Dark Workstation Mode"}
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 pt-8">
        <div className="flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex-1 flex items-center gap-2">
              <div className={`flex items-center gap-2 ${i <= step ? "" : "opacity-50"}`}>
                <div className={`w-7 h-7 border-2 border-ink rounded-[4px] grid place-items-center mono text-xs font-bold ${i < step ? "bg-primary" : i === step ? "bg-paper shadow-flat-sm" : "bg-paper"}`}>
                  {i < step ? <Check size={14} /> : i + 1}
                </div>
                <span className="text-xs font-semibold hidden sm:inline">{label}</span>
              </div>
              {i < STEPS.length - 1 && <div className="flex-1 h-[2px] bg-ink" />}
            </div>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {step === 0 && <StepSignup data={data} setData={setData} />}
        {step === 1 && <StepAgency data={data} setData={setData} />}
        {step === 2 && <StepAdvertisers data={data} setData={setData} />}
        {step === 3 && <StepPaywall data={data} setData={setData} />}
        {step === 4 && <StepSync progress={syncProgress} />}

        <div className="mt-8 flex items-center justify-between">
          <button onClick={back} disabled={step === 0 || step === 4} className="btn-flat disabled:opacity-40 disabled:cursor-not-allowed">
            <ArrowLeft size={14} /> Back
          </button>
          <div className="mono text-xs text-muted-foreground">Step {step + 1} of {STEPS.length}</div>
          <button onClick={next} disabled={step === 4 && syncProgress < 100} className="btn-flat btn-primary disabled:opacity-60">
            {step === 3 ? "Pay & sync" : step === 4 ? "Enter workspace" : "Continue"} <ArrowRight size={14} />
          </button>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
        {hint && <span className="mono text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function StepSignup({ data, setData }: any) {
  return (
    <div className="grid md:grid-cols-2 gap-8 items-start">
      <div>
        <h1 className="text-3xl font-bold">Create your operator account</h1>
        <p className="text-sm text-muted-foreground mt-2">
          RevenuAD Signal helps agencies understand who is winning, why they're winning, and what to do next.
        </p>
        <ul className="mt-6 space-y-2 text-sm">
          {["Daily creative indexing across 14 channels", "Continuous video hook inspiration loop", "Auto-generated pitch decks"].map((t) => (
            <li key={t} className="flex items-center gap-2"><Check size={14} /> {t}</li>
          ))}
        </ul>
      </div>
      <div className="card-flat p-6 space-y-4">
        <Field label="Full name">
          <input className="input-flat" placeholder="Ava Chen" value={data.fullName} onChange={(e) => setData({ ...data, fullName: e.target.value })} />
        </Field>
        <Field label="Work email">
          <input className="input-flat" type="email" placeholder="ava@studio.com" value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} />
        </Field>
        <Field label="Password" hint="min 8 chars">
          <input className="input-flat" type="password" placeholder="••••••••" value={data.password} onChange={(e) => setData({ ...data, password: e.target.value })} />
        </Field>
        <div className="mono text-[11px] text-muted-foreground flex items-center gap-1"><Lock size={11} /> SOC2 type II · GDPR ready</div>
      </div>
    </div>
  );
}

function StepAgency({ data, setData }: any) {
  return (
    <div className="max-w-2xl mx-auto card-flat p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Your agency account</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The agency holds billing and seats. Client workspaces live underneath — one per brand you manage.
        </p>
      </div>
      <Field label="Registered agency name">
        <input className="input-flat" placeholder="North Studio Co." value={data.agency} onChange={(e) => setData({ ...data, agency: e.target.value })} />
      </Field>
      <Field label="Primary Agency Acquisition Focus">
        <select className="input-flat" value={data.focus} onChange={(e) => setData({ ...data, focus: e.target.value })}>
          {FOCUS_OPTIONS.map((n) => <option key={n}>{n}</option>)}
        </select>
      </Field>
      <div className="grid md:grid-cols-3 gap-3 pt-2">
        {FOCUS_OPTIONS.map((n) => (
          <div key={n} className={`card-flat-sm p-3 cursor-pointer ${data.focus === n ? "bg-primary" : ""}`} onClick={() => setData({ ...data, focus: n })}>
            <div className="mono text-[10px]">FOCUS</div>
            <div className="font-semibold text-sm mt-1">{n}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepAdvertisers({ data, setData }: any) {
  const update = (i: number, v: string) => {
    const r = [...data.rivals]; r[i] = v; setData({ ...data, rivals: r });
  };
  return (
    <div className="max-w-2xl mx-auto card-flat p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">First client workspace</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose competitors for this client. You can add more client workspaces after onboarding.
        </p>
      </div>
      <div className="card-flat-sm p-3 bg-primary">
        <div className="mono text-[10px] font-bold uppercase">★ Master Brand Fingerprint</div>
        <p className="text-xs mt-1 leading-snug">
          Each domain you enter below becomes the <span className="font-bold">master fingerprint</span> RevenuAD Signal uses to track every cross-channel ad placement and analyse audience conversation signals around that brand. One root domain = one indexed advertiser.
        </p>
      </div>
      {[0, 1, 2].map((i) => (
        <Field key={i} label={`Competitor ${i + 1} · domain`} hint="root only">
          <div className="flex gap-2">
            <div className="flex gap-2" style={{ flex: "4 1 0%", minWidth: 0 }}>
              <div className="px-3 py-2 border-2 border-ink rounded-[4px] mono text-xs bg-secondary shrink-0">https://</div>
              <input className="input-flat flex-1 min-w-0" placeholder={["sephora.com", "lululemon.com", "glossier.com"][i]} value={data.rivals[i]} onChange={(e) => update(i, e.target.value)} />
            </div>
            <select
              className="input-flat mono text-xs min-w-0"
              style={{ flex: "1 1 0%" }}
              value={data.countries?.[i] ?? "United States"}
              onChange={(e) => {
                const c = [...(data.countries ?? ["United States", "United States", "United States"])];
                c[i] = e.target.value;
                setData({ ...data, countries: c });
              }}
              title="Target country"
            >
              {["United States", "Australia", "United Kingdom", "Canada"].map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
        </Field>
      ))}
      <div className="card-flat-sm p-3 bg-secondary mono text-[11px]">
        ► Each master fingerprint unlocks: Meta Ad Library · Google Ads Transparency · TikTok Top Ads · DSP programmatic creative · audience sentiment listening feeds.
      </div>
    </div>
  );
}

function StepPaywall({ data, setData }: any) {
  const selected = PRICING_PLANS.find((p) => p.key === data.plan)!;
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Choose your agency plan</h1>
        <p className="text-sm text-muted-foreground mt-1">
          No contracts. Cancel anytime. Add client workspaces or category packs as you grow.
        </p>
      </div>
      <div className="grid md:grid-cols-3 gap-4 max-w-5xl mx-auto">
        {PRICING_PLANS.map((p) => {
          const Icon = PLAN_ICONS[p.key];
          const active = data.plan === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setData({ ...data, plan: p.key })}
              className={`relative card-flat p-5 text-left transition ${active ? "bg-primary ring-2 ring-ink" : ""}`}
            >
              {p.badge && (
                <div className="absolute -top-3 left-3 mono text-[10px] font-bold px-2 py-1 border-2 border-ink rounded-[3px] bg-ink text-paper">
                  {p.badge}
                </div>
              )}
              <div className="font-bold flex items-center gap-1.5"><Icon size={14} /> {p.name}</div>
              <div className="mt-3 mono text-3xl font-bold">${p.price.toLocaleString()}<span className="text-sm font-normal">/mo</span></div>
              <div className="text-xs mt-2 font-semibold">{p.workspaces}</div>
              <div className="text-xs mt-1 text-muted-foreground">{p.categories}</div>
              <ul className="mt-4 space-y-1.5 text-sm">
                {p.perks.slice(0, 4).map((f) => (
                  <li key={f} className="flex items-start gap-1.5"><Check size={14} className="mt-0.5 shrink-0" /> {f}</li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
      <div className="max-w-3xl mx-auto card-flat-sm p-3 text-center mono text-[11px] font-bold uppercase tracking-wide bg-paper">
        ✓ No Contracts · ✓ No Minimum Durations · ✓ Cancel Anytime
      </div>

      <div className="max-w-xl mx-auto card-flat p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold"><CreditCard size={16} /> Secure checkout · Stripe</div>
          <div className="mono text-[10px] px-1.5 py-0.5 border-2 border-ink rounded-[3px]">SIMULATED</div>
        </div>
        <Field label="Card number">
          <input className="input-flat mono" placeholder="4242 4242 4242 4242" value={data.card} onChange={(e) => setData({ ...data, card: e.target.value })} />
        </Field>
        <Field label="Name on card">
          <input className="input-flat" placeholder="Ava Chen" value={data.cardName} onChange={(e) => setData({ ...data, cardName: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Expiry"><input className="input-flat mono" placeholder="08 / 28" value={data.exp} onChange={(e) => setData({ ...data, exp: e.target.value })} /></Field>
          <Field label="CVC"><input className="input-flat mono" placeholder="123" value={data.cvc} onChange={(e) => setData({ ...data, cvc: e.target.value })} /></Field>
        </div>
        <div className="flex items-center justify-between mono text-[11px] pt-1 border-t-2 border-ink">
          <span>{selected.name}</span>
          <span className="font-bold">${selected.price.toLocaleString()} / mo</span>
        </div>
        <div className="mono text-[10px] text-muted-foreground flex items-center gap-1"><Lock size={11} /> 256-bit TLS · PCI DSS compliant</div>
      </div>
    </div>
  );
}

function StepSync({ progress }: { progress: number }) {
  const lines = [
    "Connecting to Meta Ad Library...",
    "Indexing Google Ads Transparency Center...",
    "Fingerprinting TikTok Top Ads feed...",
    "Crawling programmatic DSP creative...",
    "Compiling continuous inspiration loop...",
  ];
  const activeIdx = Math.min(lines.length - 1, Math.floor((progress / 100) * lines.length));
  return (
    <div className="max-w-2xl mx-auto card-flat p-8 space-y-6 text-center">
      <div className="mx-auto w-14 h-14 border-2 border-ink rounded-[4px] grid place-items-center bg-primary shadow-flat-sm">
        <Loader2 size={24} className="animate-spin" />
      </div>
      <div>
        <h1 className="text-2xl font-bold">Syncing your advertisers' footprints</h1>
        <p className="text-sm text-muted-foreground mt-1">Across Search, Social, and Programmatic networks</p>
      </div>
      <div className="border-2 border-ink rounded-[4px] h-4 bg-paper overflow-hidden">
        <div className="h-full bg-primary border-r-2 border-ink transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="mono text-xs">{progress}% complete</div>
      <ul className="text-left space-y-2">
        {lines.map((l, i) => (
          <li key={l} className={`flex items-center gap-2 text-sm ${i < activeIdx ? "" : i === activeIdx ? "" : "opacity-40"}`}>
            {i < activeIdx ? <Check size={14} /> : i === activeIdx ? <Loader2 size={14} className="animate-spin" /> : <div className="w-3.5 h-3.5 border-2 border-ink rounded-[3px]" />}
            <span>{l}</span>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-3 gap-2 pt-2">
        {[0,1,2].map((i) => (
          <div key={i} className="card-flat-sm p-3 space-y-2">
            <div className="h-2 bg-secondary border border-ink rounded-[2px] animate-pulse" />
            <div className="h-2 bg-secondary border border-ink rounded-[2px] animate-pulse w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
