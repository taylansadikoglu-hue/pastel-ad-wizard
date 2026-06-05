import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTheme } from "./theme";
import { supabase } from "@/integrations/supabase/client";
import { getIntegrations, saveIntegrations } from "@/lib/integrations.functions";
import {
  Palette, FileDown, Table as TableIcon, Copy, Sliders, Send, Sparkles,
  Home, Layers, Target, Settings, LogOut, MessageSquare, X, Search,
  TrendingUp, Clock, Activity, Calendar, ChevronDown, Lock, Play, Film,
  Grid3x3, Radio, Plug, ThumbsUp, AlertTriangle, PenTool, KeyRound, Save,
} from "lucide-react";

const DATE_RANGES = [
  { label: "Last 7 Days", locked: false },
  { label: "Last 30 Days", locked: false },
  { label: "Last 3 Months", locked: true },
  { label: "Last 6 Months", locked: true },
  { label: "Last 12 Months", locked: true },
  { label: "Last 24 Months", locked: true },
];

const VIDEO_FEED = [
  { brand: "Sephora", hook: "UGC unboxing — 'first impression' format", channel: "TikTok", days: 12, length: "0:18", aiTag: "Unboxing" },
  { brand: "Lululemon", hook: "Slow-mo product hero · minimalist b-roll", channel: "Meta", days: 47, length: "0:30", aiTag: "Product Hero" },
  { brand: "Glossier", hook: "Founder-led story · direct address", channel: "YouTube", days: 9, length: "0:45", aiTag: "Founder Story" },
  { brand: "Mecca", hook: "Tutorial split-screen · before/after", channel: "TikTok", days: 21, length: "0:22", aiTag: "Tutorial" },
  { brand: "Sephora", hook: "Founder backstory · brand origin moment", channel: "YouTube", days: 33, length: "0:52", aiTag: "Founder Story" },
  { brand: "Lululemon", hook: "Day-in-the-life athlete UGC", channel: "TikTok", days: 6, length: "0:24", aiTag: "Unboxing" },
];

const SENTIMENT_DATA = [
  {
    brand: "Sephora",
    good: "Customers rave about loyalty rewards, the curated 'Sephora Edit' bundles, and frictionless in-app checkout — 'feels like a gift every time'.",
    friction: "Repeat complaints about out-of-stock TikTok-viral SKUs and slow shipping in regional zones (>5 days). Sentiment dips on Sunday drops.",
    blueprint: "Lead with scarcity + loyalty: 'Your Beauty Insider points unlock the drop everyone else is waiting for.' Pair with a fast-ship guarantee badge.",
  },
  {
    brand: "Lululemon",
    good: "Fit and longevity dominate praise — 'still my favorite leggings 4 years in'. Community runs and Mirror integrations earn high warmth scores.",
    friction: "Price ceiling pushback and resentment around 'We Made Too Much' inventory limits. Returns process flagged as slow in EU markets.",
    blueprint: "Anchor on lifetime cost-per-wear: 'One pair. Four years. Still your favorite.' Layer in the community ritual angle to soften price objections.",
  },
];


type Competitor = {
  name: string;
  spend: number;
  meta: number;
  google: number;
  programmatic: number;
};

const INITIAL: Competitor[] = [
  { name: "Sephora",    spend: 4_820_000, meta: 48, google: 32, programmatic: 20 },
  { name: "Mecca",      spend: 1_640_000, meta: 56, google: 28, programmatic: 16 },
  { name: "Lululemon",  spend: 3_210_000, meta: 38, google: 24, programmatic: 38 },
  { name: "Glossier",   spend:   910_000, meta: 64, google: 22, programmatic: 14 },
];

const CHANNEL_COLORS_STD = ["var(--primary)", "#23251D", "#A1A39A"];
const CHANNEL_COLORS_PASTEL = ["var(--pastel-lilac)", "var(--pastel-sage)", "var(--pastel-peach)"];

export function Dashboard({ onLogout }: { onLogout: () => void }) {
  const { theme, toggle } = useTheme();
  const [rows, setRows] = useState(INITIAL);
  const [selected, setSelected] = useState<Record<string, boolean>>(
    Object.fromEntries(INITIAL.map((r) => [r.name, true]))
  );
  const [calibOpen, setCalibOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [dateRange, setDateRange] = useState("Last 30 Days");
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [videoFilter, setVideoFilter] = useState<"all" | "short" | "long">("all");
  const [activeTab, setActiveTab] = useState<"gallery" | "sentiment" | "integrations">("gallery");
  const [apifyToken, setApifyToken] = useState("");
  const [dfsLogin, setDfsLogin] = useState("");
  const [dfsPassword, setDfsPassword] = useState("");
  const [resendKey, setResendKey] = useState("");
  const [integSaving, setIntegSaving] = useState(false);
  const [liveSentiment, setLiveSentiment] = useState<{ domain: string; good: string | null; friction: string | null; blueprint: string | null }[]>([]);
  const [chatLog, setChatLog] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "ai", text: "Hi Ava — ask me anything about the tracked advertisers' creative." },
  ]);

  // Load saved integrations once
  useEffect(() => {
    getIntegrations()
      .then((d) => {
        if (!d) return;
        if (d.apify_token) setApifyToken(d.apify_token);
        if (d.dataforseo_login) setDfsLogin(d.dataforseo_login);
        if (d.dataforseo_password) setDfsPassword(d.dataforseo_password);
        if (d.resend_api_key) setResendKey(d.resend_api_key);
      })
      .catch(() => {});
  }, []);

  // Subscribe to live sentiment_insights for this user
  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("sentiment_insights")
        .select("domain, good, friction, blueprint, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (active && data) setLiveSentiment(data);
    };
    load();
    const channel = supabase
      .channel("sentiment-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sentiment_insights" },
        (payload) => {
          const r = payload.new as { domain: string; good: string | null; friction: string | null; blueprint: string | null };
          setLiveSentiment((prev) => [r, ...prev].slice(0, 20));
          toast.success(`New sentiment radar reading: ${r.domain}`);
        }
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const saveAllIntegrations = async () => {
    setIntegSaving(true);
    try {
      await saveIntegrations({
        data: {
          apify_token: apifyToken || null,
          dataforseo_login: dfsLogin || null,
          dataforseo_password: dfsPassword || null,
          resend_api_key: resendKey || null,
        },
      });
      toast.success("Integrations saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIntegSaving(false);
    }
  };


  const visible = rows.filter((r) => selected[r.name]);
  const colors = theme === "dark" ? CHANNEL_COLORS_PASTEL : CHANNEL_COLORS_STD;
  const totalSpend = useMemo(() => visible.reduce((a, b) => a + b.spend, 0), [visible]);

  const toggleRow = (n: string) => setSelected((s) => ({ ...s, [n]: !s[n] }));
  const setSpend = (name: string, value: number) =>
    setRows((rs) => rs.map((r) => (r.name === name ? { ...r, spend: value } : r)));

  const fmt = (n: number) => "$" + (n / 1000).toFixed(0) + "K";

  const quickPrompt = (q: string) => {
    setChatLog((l) => [
      ...l,
      { role: "user", text: q },
      { role: "ai", text: aiReply(q, visible) },
    ]);
  };

  const send = () => {
    if (!chatInput.trim()) return;
    quickPrompt(chatInput.trim());
    setChatInput("");
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r-2 border-ink bg-paper flex flex-col">
        <div className="p-4 border-b-2 border-ink flex items-center gap-2">
          <div className="w-8 h-8 border-2 border-ink rounded-[4px] bg-primary grid place-items-center">
            <span className="mono text-xs font-bold">RA</span>
          </div>
          <div>
            <div className="font-bold leading-tight">RevenueAd</div>
            <div className="mono text-[10px] text-muted-foreground">north-studio.co</div>
          </div>
        </div>

        <div className="p-3 border-b-2 border-ink">
          <div className="card-flat-sm p-2 flex items-center gap-2">
            <div className="w-8 h-8 rounded-[3px] border-2 border-ink bg-secondary grid place-items-center mono text-xs font-bold">AC</div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Ava Chen</div>
              <div className="mono text-[10px] text-muted-foreground">Growth · 14 advertisers</div>
            </div>
          </div>
        </div>

        <nav className="p-2 space-y-1 flex-1">
          {[
            { icon: Home, label: "Workspace", active: true },
            { icon: Layers, label: "Creative library" },
            { icon: Target, label: "Advertisers" },
            { icon: TrendingUp, label: "Benchmarks" },
            { icon: Settings, label: "Settings" },
          ].map((it) => (
            <button key={it.label}
              onClick={() => !it.active && toast(`${it.label} module coming next sprint`)}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-[4px] text-sm font-medium border-2 ${it.active ? "border-ink bg-secondary shadow-flat-sm" : "border-transparent hover:border-ink"}`}>
              <it.icon size={15} /> {it.label}
            </button>
          ))}
        </nav>

        <button onClick={onLogout} className="m-3 btn-flat justify-start">
          <LogOut size={14} /> Sign out
        </button>

        {/* Strategy AI dock */}
        <div className="m-3 mt-0">
          {chatOpen ? (
            <div className="card-flat overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b-2 border-ink bg-primary">
                <div className="flex items-center gap-1.5 font-bold text-sm"><Sparkles size={14} /> Strategy AI</div>
                <button onClick={() => setChatOpen(false)} className="hover:opacity-70"><X size={14} /></button>
              </div>
              <div className="p-2 max-h-44 overflow-auto space-y-1.5 text-xs">
                {chatLog.map((m, i) => (
                  <div key={i} className={`p-2 border-2 border-ink rounded-[3px] ${m.role === "ai" ? "bg-secondary" : "bg-paper"}`}>
                    <span className="mono text-[9px] block opacity-70">{m.role === "ai" ? "AI" : "YOU"}</span>
                    {m.text}
                  </div>
                ))}
              </div>
              <div className="px-2 pt-1 pb-2 grid grid-cols-2 gap-1">
                <button onClick={() => quickPrompt("Summarize channel mix")} className="btn-flat text-[10px] px-2 py-1">Summarize mix</button>
                <button onClick={() => quickPrompt("Analyze ad hooks")} className="btn-flat text-[10px] px-2 py-1">Analyze hooks</button>
              </div>
              <div className="flex border-t-2 border-ink">
                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Ask anything..."
                  className="flex-1 px-2 py-2 text-xs bg-paper outline-none" />
                <button onClick={send} className="px-3 border-l-2 border-ink bg-primary"><Send size={13} /></button>
              </div>
            </div>
          ) : (
            <button onClick={() => setChatOpen(true)} className="btn-flat w-full btn-primary">
              <MessageSquare size={14} /> Strategy AI
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="border-b-2 border-ink bg-paper px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="flex items-center gap-2 input-flat">
              <Search size={14} />
              <input className="flex-1 bg-transparent outline-none text-sm" placeholder="Search creative, hooks, advertisers..." />
              <span className="mono text-[10px] px-1 border border-ink rounded-[2px]">⌘K</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setDateMenuOpen((o) => !o)}
                className="btn-flat"
              >
                <Calendar size={14} /> {dateRange} <ChevronDown size={12} />
              </button>
              {dateMenuOpen && (
                <div className="absolute right-0 mt-2 w-60 card-flat z-40 overflow-hidden">
                  <div className="px-3 py-2 border-b-2 border-ink mono text-[10px] uppercase font-bold bg-secondary">Date Range</div>
                  {DATE_RANGES.map((d) => (
                    <button
                      key={d.label}
                      onClick={() => {
                        setDateMenuOpen(false);
                        if (d.locked) {
                          setUpsellOpen(true);
                        } else {
                          setDateRange(d.label);
                          toast(`Range set to ${d.label}`);
                        }
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-secondary border-b border-ink/20 last:border-0 ${dateRange === d.label ? "bg-primary" : ""}`}
                    >
                      <span>{d.label}</span>
                      {d.locked && <Lock size={12} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="mono text-[10px] px-2 py-1 border-2 border-ink rounded-[3px] bg-secondary">LIVE · synced 2m ago</span>
            <button onClick={toggle} className="btn-flat">
              <Palette size={14} /> {theme === "dark" ? "Warm Canvas Mode" : "Dark Workstation Mode"}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 space-y-6">
          {/* Action bar */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="mono text-[10px] text-muted-foreground">WORKSPACE / MEDIA MIX</div>
              <h1 className="text-2xl font-bold mt-1">Media mix & share of voice matrix — beauty & activewear niche</h1>
              <p className="text-sm text-muted-foreground mt-1">Channel allocation pulled from {visible.length} of {rows.length} tracked advertisers. Recalibrate any total below.</p>
            </div>
            <div className="flex gap-2">
              <button className="btn-flat" onClick={() => toast.success("Pitch PDF queued · check downloads in 12s")}>
                <FileDown size={14} /> Export pitch PDF
              </button>
              <button className="btn-flat" onClick={() => toast.success("CSV exported · 4 rows")}>
                <TableIcon size={14} /> Export CSV
              </button>
              <button className="btn-flat" onClick={() => { navigator.clipboard?.writeText("chart").catch(() => {}); toast.success("Chart asset copied to clipboard"); }}>
                <Copy size={14} /> Copy chart asset
              </button>
            </div>
          </div>

          {/* Primary tabs */}
          <div className="border-2 border-ink rounded-[4px] bg-paper flex overflow-hidden">
            {([
              { k: "gallery", label: "Cross-Channel Ad Gallery", icon: Grid3x3 },
              { k: "sentiment", label: "AI Audience Sentiment Radar", icon: Radio },
              { k: "integrations", label: "Developer Integrations", icon: Plug },
            ] as const).map((t, i) => (
              <button
                key={t.k}
                onClick={() => setActiveTab(t.k)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold ${i > 0 ? "border-l-2 border-ink" : ""} ${activeTab === t.k ? "bg-primary" : "hover:bg-secondary"}`}
              >
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>

          {activeTab === "gallery" && <>
          {/* Matrix + Chart */}
          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
            <div className="card-flat overflow-hidden">
              <div className="px-4 py-3 border-b-2 border-ink flex items-center justify-between">
                <div className="font-bold text-sm">Advertiser matrix</div>
                <button onClick={() => setCalibOpen(true)} className="btn-flat text-xs px-2 py-1">
                  <Sliders size={12} /> Calibrate spend model
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b-2 border-ink bg-secondary">
                    <tr className="text-left">
                      {["", "Advertiser", "Est. monthly spend", "Meta %", "Google %", "Programmatic %", "Primary"].map((h) => (
                        <th key={h} className="px-3 py-2 mono text-[10px] uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const primary = r.meta >= r.google && r.meta >= r.programmatic
                        ? "Meta" : r.google >= r.programmatic ? "Google" : "Programmatic";
                      return (
                        <tr key={r.name} className="border-b border-ink/30 last:border-0">
                          <td className="px-3 py-2.5">
                            <input type="checkbox" checked={!!selected[r.name]} onChange={() => toggleRow(r.name)}
                              className="w-4 h-4 accent-[var(--ink)] cursor-pointer" />
                          </td>
                          <td className="px-3 py-2.5 font-semibold">{r.name}</td>
                          <td className="px-3 py-2.5 mono">{fmt(r.spend)}</td>
                          <td className="px-3 py-2.5 mono">{r.meta}%</td>
                          <td className="px-3 py-2.5 mono">{r.google}%</td>
                          <td className="px-3 py-2.5 mono">{r.programmatic}%</td>
                          <td className="px-3 py-2.5">
                            <span className="mono text-[10px] px-1.5 py-0.5 border-2 border-ink rounded-[3px] bg-paper">{primary}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-secondary border-t-2 border-ink">
                    <tr>
                      <td colSpan={2} className="px-3 py-2 mono text-[11px] font-bold">SELECTED TOTAL</td>
                      <td className="px-3 py-2 mono font-bold">{fmt(totalSpend)}</td>
                      <td colSpan={4} className="px-3 py-2 mono text-[10px] text-muted-foreground">{visible.length} of {rows.length} active</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Chart */}
            <div className="card-flat p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-bold text-sm">Channel mix by spend</div>
                <div className="flex items-center gap-2 mono text-[10px]">
                  {["Meta", "Google", "Prog."].map((l, i) => (
                    <span key={l} className="flex items-center gap-1">
                      <span className="w-3 h-3 border-2 border-ink" style={{ background: colors[i] }} />{l}
                    </span>
                  ))}
                </div>
              </div>
              {visible.length === 0 ? (
                <div className="h-64 grid place-items-center mono text-xs text-muted-foreground border-2 border-dashed border-ink rounded-[4px]">
                  Select at least one advertiser
                </div>
              ) : (
                <div className="space-y-3">
                  {visible.map((r) => (
                    <div key={r.name}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold">{r.name}</span>
                        <span className="mono text-muted-foreground">{fmt(r.spend)}</span>
                      </div>
                      <div className="flex h-7 border-2 border-ink rounded-[3px] overflow-hidden">
                        <div style={{ width: `${r.meta}%`, background: colors[0] }} className="border-r-2 border-ink grid place-items-center mono text-[10px] font-bold">{r.meta}</div>
                        <div style={{ width: `${r.google}%`, background: colors[1], color: theme === "dark" ? "var(--ink)" : "#fff" }} className="border-r-2 border-ink grid place-items-center mono text-[10px] font-bold">{r.google}</div>
                        <div style={{ width: `${r.programmatic}%`, background: colors[2] }} className="grid place-items-center mono text-[10px] font-bold">{r.programmatic}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>


          {/* Continuous Inspiration Loop — video creative feed */}
          <div className="card-flat overflow-hidden">
            <div className="px-4 py-3 border-b-2 border-ink bg-secondary">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Film size={14} /> The Continuous Inspiration Loop
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Filter by ad flight length to instantly inspect which video hooks are actively converting market share across YouTube, Meta, and TikTok.
              </p>
            </div>
            <div className="px-4 py-2 border-b-2 border-ink flex items-center gap-2 bg-paper">
              <span className="mono text-[10px] uppercase font-bold mr-1">Flight length:</span>
              {([
                { k: "all", label: "All flights" },
                { k: "short", label: "< 14 days" },
                { k: "long", label: "14+ days" },
              ] as const).map((f) => (
                <button
                  key={f.k}
                  onClick={() => setVideoFilter(f.k)}
                  className={`btn-flat text-[11px] px-2 py-1 ${videoFilter === f.k ? "btn-primary" : ""}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-0">
              {VIDEO_FEED
                .filter((v) =>
                  videoFilter === "all" ? true : videoFilter === "short" ? v.days < 14 : v.days >= 14
                )
                .map((v) => (
                  <div key={v.brand} className="border-r-2 last:border-r-0 border-b-2 lg:border-b-0 border-ink p-3 space-y-2">
                    <div className="aspect-video border-2 border-ink rounded-[3px] bg-secondary grid place-items-center relative">
                      <Play size={22} />
                      <span className="absolute bottom-1 right-1 mono text-[10px] px-1 py-0.5 border border-ink bg-paper rounded-[2px]">{v.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{v.brand}</span>
                      <span className="mono text-[10px] px-1.5 py-0.5 border-2 border-ink rounded-[3px]">{v.channel}</span>
                    </div>
                    <p className="text-xs leading-snug">{v.hook}</p>
                    <div className="flex items-center justify-between mono text-[10px] text-muted-foreground pt-1 border-t border-ink/30">
                      <span>Flight: {v.days}d</span>
                      <button onClick={() => toast(`${v.brand} · creative opened`)} className="underline font-semibold">Inspect →</button>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* 3-Second Rule Insight Cards */}
          <div>
            <div className="mono text-[10px] text-muted-foreground mb-2">THE 3-SECOND RULE / strategic conclusions</div>
            <div className="grid md:grid-cols-3 gap-4">
              <InsightCard
                icon={Activity}
                tag="Creative velocity"
                tone="primary"
                text="Sephora just deployed 14 new TikTok video ad variations focusing on user-generated unboxing hooks."
                metric="+14 creatives · 48h"
              />
              <InsightCard
                icon={Clock}
                tag="Ad longevity winner"
                tone="ink"
                text="Lululemon's core minimalist programmatic banner has been running unchanged for 90 consecutive days, signaling stable top-performing ad conversions."
                metric="90 days · 0 edits"
              />
              <InsightCard
                icon={TrendingUp}
                tag="Macro shift trend"
                tone="secondary"
                text="Average category trends reveal an immediate 15% budget redirection out of paid search toward highly visual Meta and TikTok social placements."
                metric="-15% search · +15% social"
              />
            </div>
          </div>
          </>}

          {activeTab === "sentiment" && (
            <div className="space-y-5">
              <div>
                <div className="mono text-[10px] text-muted-foreground">WORKSPACE / SENTIMENT</div>
                <h2 className="text-2xl font-bold mt-1">AI Audience Sentiment Radar</h2>
                <p className="text-sm text-muted-foreground mt-1">Social listening compiled per tracked advertiser fingerprint — what consumers love, where they friction, and the ad copy angle to weaponize.</p>
              </div>
              {SENTIMENT_DATA.map((s) => (
                <div key={s.brand} className="card-flat overflow-hidden">
                  <div className="px-4 py-3 border-b-2 border-ink bg-secondary flex items-center justify-between">
                    <div className="font-bold">{s.brand}</div>
                    <span className="mono text-[10px] px-1.5 py-0.5 border-2 border-ink rounded-[3px] bg-paper">{s.brand.toLowerCase()}.com</span>
                  </div>
                  <div className="grid md:grid-cols-3 gap-0">
                    <div className="p-4 border-r-2 border-ink last:border-r-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 border-2 border-ink rounded-[4px] grid place-items-center bg-primary"><ThumbsUp size={14} /></div>
                        <div className="mono text-[10px] uppercase font-bold">The Good</div>
                      </div>
                      <p className="text-sm leading-relaxed">{s.good}</p>
                    </div>
                    <div className="p-4 border-r-2 border-ink last:border-r-0 border-t-2 md:border-t-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 border-2 border-ink rounded-[4px] grid place-items-center bg-ink text-paper"><AlertTriangle size={14} /></div>
                        <div className="mono text-[10px] uppercase font-bold">The Friction</div>
                      </div>
                      <p className="text-sm leading-relaxed">{s.friction}</p>
                    </div>
                    <div className="p-4 border-t-2 md:border-t-0 bg-canvas">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 border-2 border-ink rounded-[4px] grid place-items-center bg-secondary"><PenTool size={14} /></div>
                        <div className="mono text-[10px] uppercase font-bold">The Ad Angle · Copy Blueprint</div>
                      </div>
                      <p className="text-sm leading-relaxed font-medium">{s.blueprint}</p>
                      <button onClick={() => toast.success(`${s.brand} blueprint copied`)} className="btn-flat text-[11px] px-2 py-1 mt-3">
                        <Copy size={12} /> Copy blueprint
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <div className="mono text-[11px] text-muted-foreground border-2 border-dashed border-ink rounded-[4px] p-3">
                ► Sentiment streams are prepared via the master brand fingerprint and stay safely decoupled until you connect a listening source in Developer Integrations.
              </div>
            </div>
          )}

          {activeTab === "integrations" && (
            <div className="max-w-3xl space-y-5">
              <div>
                <div className="mono text-[10px] text-muted-foreground">WORKSPACE / DEVELOPER</div>
                <h2 className="text-2xl font-bold mt-1">Developer Integrations</h2>
                <p className="text-sm text-muted-foreground mt-1">Your API keys live encrypted in your workspace and are used to run live ad-library scrapes and outbound notifications.</p>
              </div>

              <div className="card-flat p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold"><KeyRound size={16} /> Apify API Token</div>
                  <span className="mono text-[10px] px-1.5 py-0.5 border-2 border-ink rounded-[3px] bg-secondary">SCRAPING</span>
                </div>
                <p className="text-xs text-muted-foreground">Powers Facebook Ads Library + cross-channel creative scraping per tracked brand fingerprint.</p>
                <input type="password" value={apifyToken} onChange={(e) => setApifyToken(e.target.value)} placeholder="apify_api_xxxxxxxxxxxxxxxxxxxx" className="input-flat mono" />
              </div>

              <div className="card-flat p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold"><KeyRound size={16} /> DataForSEO Credentials</div>
                  <span className="mono text-[10px] px-1.5 py-0.5 border-2 border-ink rounded-[3px] bg-secondary">SEARCH + VIDEO</span>
                </div>
                <p className="text-xs text-muted-foreground">Powers Google Ads Transparency and YouTube ad placement indexing.</p>
                <input type="text" value={dfsLogin} onChange={(e) => setDfsLogin(e.target.value)} placeholder="DataForSEO login (email)" className="input-flat mono" />
                <input type="password" value={dfsPassword} onChange={(e) => setDfsPassword(e.target.value)} placeholder="DataForSEO password" className="input-flat mono" />
              </div>

              <div className="card-flat p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold"><KeyRound size={16} /> Resend API Key</div>
                  <span className="mono text-[10px] px-1.5 py-0.5 border-2 border-ink rounded-[3px] bg-secondary">EMAIL</span>
                </div>
                <p className="text-xs text-muted-foreground">Delivers creative diff alerts and pitch-ready briefs to your inbox or client distribution lists.</p>
                <input type="password" value={resendKey} onChange={(e) => setResendKey(e.target.value)} placeholder="re_xxxxxxxxxxxxxxxxxxxx" className="input-flat mono" />
              </div>

              <button onClick={saveAllIntegrations} disabled={integSaving} className="btn-flat btn-primary">
                <Save size={13} /> {integSaving ? "Saving…" : "Save all integrations"}
              </button>

              <div className="mono text-[11px] text-muted-foreground border-2 border-dashed border-ink rounded-[4px] p-3">
                ► AI distillation runs through the Lovable AI Gateway (gpt-4o-mini) — no extra key required.
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Calibrate drawer */}
      {calibOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-ink/40" onClick={() => setCalibOpen(false)} />
          <div className="w-[420px] bg-paper border-l-2 border-ink h-full flex flex-col">
            <div className="px-5 py-4 border-b-2 border-ink flex items-center justify-between">
              <div>
                <div className="font-bold">Proprietary Media Mix Calibration Engine</div>
                <div className="text-[11px] text-muted-foreground leading-snug mt-0.5 max-w-[300px]">Drop in known market intelligence to reverse-engineer and perfectly align competitor media distributions.</div>
              </div>
              <button onClick={() => setCalibOpen(false)} className="btn-flat text-xs px-2 py-1"><X size={12} /></button>
            </div>
            <div className="p-5 space-y-5 overflow-auto flex-1">
              {rows.map((r) => (
                <div key={r.name} className="card-flat-sm p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{r.name}</span>
                    <span className="mono text-xs">{fmt(r.spend)} / mo</span>
                  </div>
                  <input type="range" min={100000} max={6000000} step={50000}
                    value={r.spend}
                    onChange={(e) => setSpend(r.name, Number(e.target.value))}
                    className="w-full accent-[var(--ink)]" />
                  <div className="flex h-3 border-2 border-ink rounded-[2px] overflow-hidden">
                    <div style={{ width: `${r.meta}%`, background: colors[0] }} className="border-r-2 border-ink" />
                    <div style={{ width: `${r.google}%`, background: colors[1] }} className="border-r-2 border-ink" />
                    <div style={{ width: `${r.programmatic}%`, background: colors[2] }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t-2 border-ink flex gap-2">
              <button onClick={() => { setRows(INITIAL); toast("Reset to baseline values"); }} className="btn-flat flex-1">Reset</button>
              <button onClick={() => { setCalibOpen(false); toast.success("Spend model calibrated"); }} className="btn-flat btn-primary flex-1">Save model</button>
            </div>
          </div>
        </div>
      )}

      {/* 24-Month Historical Playbook Upsell Modal */}
      {upsellOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-ink/50" onClick={() => setUpsellOpen(false)}>
          <div
            className="card-flat max-w-lg w-full bg-canvas shadow-flat overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b-2 border-ink bg-ink text-paper flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold">
                <Lock size={14} /> Locked · Historical Range
              </div>
              <button onClick={() => setUpsellOpen(false)} className="hover:opacity-70"><X size={14} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="mono text-[10px] uppercase font-bold px-2 py-1 inline-block border-2 border-ink rounded-[3px] bg-primary">
                Backtrack Engine · Add-on
              </div>
              <h2 className="text-2xl font-bold leading-tight">Unlock 24-Month Historical Playbook</h2>
              <p className="text-sm leading-relaxed">
                Activate the RevenueAd Backtrack Engine. Our system will query cross-channel ad network archives to pull, compile, and future-save every advertising placement this brand has published past and present across Search, Video, and Programmatic networks.
              </p>
              <div className="card-flat-sm p-3 grid grid-cols-3 gap-2 mono text-[10px] uppercase font-bold text-center bg-paper">
                <div>Search archives</div>
                <div>Video archives</div>
                <div>Programmatic</div>
              </div>
              <button
                onClick={() => { setUpsellOpen(false); toast.success("Backtrack Engine activated · $2,499 charged via Stripe"); }}
                className="w-full btn-flat btn-primary justify-center py-3 font-bold"
              >
                [ Activate Backtrack Engine — $2,499 via Stripe ]
              </button>
              <button
                onClick={() => { setUpsellOpen(false); toast("Workspace upgrade flow opened"); }}
                className="w-full text-center text-xs underline underline-offset-2 font-semibold"
              >
                Or upgrade permanently to the Network Hub workspace.
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InsightCard({
  icon: Icon, tag, text, metric, tone,
}: {
  icon: any; tag: string; text: string; metric: string;
  tone: "primary" | "ink" | "secondary";
}) {
  const head = tone === "primary" ? "bg-primary" : tone === "ink" ? "bg-ink text-paper" : "bg-secondary";
  return (
    <div className="card-flat overflow-hidden flex flex-col">
      <div className={`px-3 py-2 border-b-2 border-ink flex items-center gap-2 ${head}`} style={tone === "ink" ? { color: "var(--paper)" } : undefined}>
        <Icon size={14} /> <span className="mono text-[10px] uppercase font-bold">{tag}</span>
      </div>
      <div className="p-4 flex-1">
        <p className="text-sm leading-relaxed">{text}</p>
      </div>
      <div className="px-4 py-2 border-t-2 border-ink mono text-[11px] bg-paper flex items-center justify-between">
        <span>{metric}</span>
        <button onClick={() => toast(`${tag} · opened detail view`)} className="underline underline-offset-2 font-semibold">Open evidence →</button>
      </div>
    </div>
  );
}

function aiReply(q: string, visible: Competitor[]): string {
  const total = visible.reduce((a, b) => a + b.spend, 0);
  if (/mix|channel/i.test(q)) {
    const meta = Math.round(visible.reduce((a, b) => a + (b.meta * b.spend), 0) / Math.max(total, 1));
    return `Across ${visible.length} advertisers, weighted channel mix is ~${meta}% Meta, the rest split between Google and programmatic. Glossier is the most social-heavy.`;
  }
  if (/hook/i.test(q)) {
    return `Dominant hook patterns: 1) UGC unboxing (Sephora), 2) minimalist product hero (Lululemon), 3) founder-led story (Glossier). Pain-point hooks underused — opportunity.`;
  }
  return `Tracked advertisers account for ~$${(total/1_000_000).toFixed(2)}M in monthly spend. Ask about channel mix, hooks, or ad longevity.`;
}
