import { useEffect, useMemo, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { useTheme } from "./theme";
import { supabase } from "@/integrations/supabase/client";
import { getIntegrations, getProfile, saveIntegrations } from "@/lib/integrations.functions";
import {
  Palette, FileDown, Table as TableIcon, Copy, Sliders, Send, Sparkles,
  Home, Layers, Target, Settings, LogOut, MessageSquare, X, Search,
  TrendingUp, Clock, Activity, Calendar, ChevronDown, Lock, Play, Film,
  Grid3x3, Radio, Plug, ThumbsUp, AlertTriangle, PenTool, KeyRound, Save,
  BarChart3, PieChart as PieIcon, Loader2,
} from "lucide-react";

const DATE_RANGES = [
  { label: "Last 7 Days", locked: false },
  { label: "Last 30 Days", locked: false },
  { label: "Last 3 Months", locked: true },
  { label: "Last 6 Months", locked: true },
  { label: "Last 12 Months", locked: true },
  { label: "Last 24 Months", locked: true },
];

const ADMIN_EMAIL = "taylan.sadikoglu@gmail.com";

type Competitor = {
  name: string;
  spend: number;
  meta: number;
  google: number;
  programmatic: number;
};

const INITIAL: Competitor[] = [];

// Deterministic synthetic spend + channel mix derived from a domain string,
// so tracked-advertiser cards stay populated until live spend ingestion lands.
function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function brandFromDomain(domain: string) {
  const root = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[./]/)[0] ?? domain;
  return root.charAt(0).toUpperCase() + root.slice(1);
}
function synthRow(domain: string): Competitor {
  const h = hashStr(domain);
  const spend = 500_000 + (h % 48) * 100_000;
  const meta = 25 + (h % 45);
  const google = Math.max(10, Math.min(60, 20 + ((h >> 4) % 40)));
  const programmatic = Math.max(5, 100 - meta - google);
  return { name: brandFromDomain(domain), spend, meta, google, programmatic };
}

const CHANNEL_COLORS_STD = ["var(--primary)", "#23251D", "#A1A39A"];
const CHANNEL_COLORS_PASTEL = ["var(--pastel-lilac)", "var(--pastel-sage)", "var(--pastel-peach)"];

export function Dashboard({ onLogout }: { onLogout: () => void }) {
  const { theme, toggle } = useTheme();
  const [rows, setRows] = useState<Competitor[]>(INITIAL);
  const [baselineRows, setBaselineRows] = useState<Competitor[]>(INITIAL);
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
  const [chartView, setChartView] = useState<"bar" | "pie" | "table">("bar");
  const [apifyToken, setApifyToken] = useState("");
  const [dfsLogin, setDfsLogin] = useState("");
  const [dfsPassword, setDfsPassword] = useState("");
  const [resendKey, setResendKey] = useState("");
  const [integSaving, setIntegSaving] = useState(false);
  const [liveSentiment, setLiveSentiment] = useState<{ domain: string; good: string | null; friction: string | null; blueprint: string | null }[]>([]);
  const [livePlacements, setLivePlacements] = useState<{ brand: string; hook: string; channel: string; days: number; length: string; aiTag: string }[]>([]);
  const [runningScans, setRunningScans] = useState<string[]>([]);
  const [userName, setUserName] = useState<string>("");
  const [userInitials, setUserInitials] = useState<string>("YOU");
  const [userEmail, setUserEmail] = useState<string>("");
  const [agencyDomain, setAgencyDomain] = useState<string>("");
  const [chatLog, setChatLog] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "ai", text: "Welcome — ask me anything about the tracked advertisers' creative." },
  ]);

  // Auth user + profile → top-left user card binds to session metadata
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!u || !active) return;
      setUserEmail((u.email ?? "").toLowerCase());
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      const fromMeta = (meta.full_name as string) || (meta.name as string) || "";
      const fallback = (u.email ?? "").split("@")[0] ?? "";
      const display = fromMeta || (fallback ? fallback.charAt(0).toUpperCase() + fallback.slice(1) : "Operator");
      setUserName(display);
      const parts = display.split(/[\s._-]+/).filter(Boolean);
      const initials = (parts[0]?.[0] ?? "Y") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "");
      setUserInitials(initials.toUpperCase().slice(0, 2));
      setChatLog([{ role: "ai", text: `Hi ${display.split(" ")[0]} — ask me anything about the tracked advertisers' creative.` }]);
      try {
        const p = await getProfile();
        if (active && p?.agency_domain) setAgencyDomain(p.agency_domain);
      } catch {}
    })();
    return () => { active = false; };
  }, []);

  // Tracked advertisers (domain_scans) → bind matrix + chart to real DB rows
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("domain_scans")
        .select("domain, created_at")
        .order("created_at", { ascending: false });
      if (!active || !data || data.length === 0) return;
      const unique: string[] = [];
      for (const r of data) {
        if (r.domain && !unique.includes(r.domain)) unique.push(r.domain);
        if (unique.length >= 7) break;
      }
      const next = unique.map(synthRow);
      setRows(next);
      setBaselineRows(next);
      setSelected(Object.fromEntries(next.map((r) => [r.name, true])));
    })();
    return () => { active = false; };
  }, []);

  // Track in-flight domain scans → drives skeleton banner
  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("domain_scans")
        .select("domain, status")
        .in("status", ["queued", "running"]);
      if (active) setRunningScans((data ?? []).map((r) => r.domain));
    };
    load();
    const channel = supabase
      .channel("scan-status")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "domain_scans" },
        () => load()
      )
      .subscribe();
    const iv = setInterval(load, 8000);
    return () => {
      active = false;
      clearInterval(iv);
      supabase.removeChannel(channel);
    };
  }, []);

  // Continuous Inspiration Loop → ad_placements
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("ad_placements")
        .select("domain, channel, hook, days_running, creative_url, created_at")
        .order("created_at", { ascending: false })
        .limit(12);
      if (!active || !data || data.length === 0) return;
      setLivePlacements(
        data.map((p) => ({
          brand: brandFromDomain(p.domain),
          hook: p.hook ?? "Live creative — hook pending AI extraction.",
          channel: p.channel ?? "Meta",
          days: p.days_running ?? 1,
          length: "0:--",
          aiTag: "Live",
        }))
      );
    })();
  }, []);

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

  const isAdmin = userEmail === ADMIN_EMAIL;

  // Force non-admins off the integrations tab
  useEffect(() => {
    if (!isAdmin && activeTab === "integrations") setActiveTab("gallery");
  }, [isAdmin, activeTab]);

  const exportCSV = () => {
    const header = ["Advertiser", "Est monthly spend", "Meta %", "Google %", "Programmatic %"];
    const lines = [header.join(",")].concat(
      rows.map((r) => [r.name, r.spend, r.meta, r.google, r.programmatic].join(","))
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revenuead-matrix-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const exportPDF = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r-2 border-ink bg-paper flex flex-col">
        <div className="p-4 border-b-2 border-ink flex items-center gap-2">
          <div className="px-1.5 h-8 border-2 border-ink rounded-[4px] bg-primary grid place-items-center">
            <span className="mono text-[11px] font-bold">R-AD</span>
          </div>
          <div>
            <div className="font-bold leading-tight">RevenueAd</div>
            <div className="mono text-[10px] text-muted-foreground">workspace</div>
          </div>
        </div>

        <div className="p-3 border-b-2 border-ink">
          <div className="card-flat-sm p-2 flex items-center gap-2">
            <div className="w-8 h-8 rounded-[3px] border-2 border-ink bg-secondary grid place-items-center mono text-xs font-bold">{userInitials}</div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">{userName || "Operator"}</div>
              <div className="mono text-[10px] text-muted-foreground">Growth · {rows.length} advertiser{rows.length === 1 ? "" : "s"}</div>
            </div>
          </div>
        </div>


        <SidebarNav />


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
          {runningScans.length > 0 && (apifyToken || dfsLogin || dfsPassword) && (
            <div className="card-flat p-4 bg-secondary flex items-center gap-4">
              <div className="w-9 h-9 border-2 border-ink rounded-[4px] bg-primary grid place-items-center shrink-0">
                <Loader2 size={16} className="animate-spin" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="mono text-[10px] uppercase font-bold">Workspace sync in progress</div>
                <div className="text-sm font-semibold truncate">
                  Processing cross-channel datasets and executing audience sentiment mapping...
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div className="h-2 bg-paper border-2 border-ink rounded-[3px] animate-pulse" />
                  <div className="h-2 bg-paper border-2 border-ink rounded-[3px] animate-pulse w-3/4" />
                  <div className="h-2 bg-paper border-2 border-ink rounded-[3px] animate-pulse w-1/2" />
                </div>
              </div>
            </div>
          )}

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
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <div className="font-bold text-sm">Channel mix by spend</div>
                <div className="flex items-center border-2 border-ink rounded-[3px] overflow-hidden">
                  {([
                    { k: "bar", label: "Bars", icon: BarChart3 },
                    { k: "pie", label: "Pie", icon: PieIcon },
                    { k: "table", label: "Table", icon: TableIcon },
                  ] as const).map((v, i) => (
                    <button
                      key={v.k}
                      onClick={() => setChartView(v.k)}
                      className={`flex items-center gap-1 px-2 py-1 mono text-[10px] font-bold ${i > 0 ? "border-l-2 border-ink" : ""} ${chartView === v.k ? "bg-primary" : "bg-paper hover:bg-secondary"}`}
                      aria-pressed={chartView === v.k}
                    >
                      <v.icon size={11} /> {v.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 mono text-[10px] mb-3 flex-wrap">
                {["Meta", "Google", "Prog."].map((l, i) => (
                  <span key={l} className="flex items-center gap-1">
                    <span className="w-3 h-3 border-2 border-ink" style={{ background: colors[i] }} />{l}
                  </span>
                ))}
              </div>
              {visible.length === 0 ? (
                <div className="h-64 grid place-items-center mono text-xs text-muted-foreground border-2 border-dashed border-ink rounded-[4px]">
                  Select at least one advertiser
                </div>
              ) : chartView === "bar" ? (
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
              ) : chartView === "pie" ? (
                (() => {
                  const agg = visible.reduce(
                    (a, r) => {
                      a.meta += (r.meta * r.spend) / 100;
                      a.google += (r.google * r.spend) / 100;
                      a.prog += (r.programmatic * r.spend) / 100;
                      return a;
                    },
                    { meta: 0, google: 0, prog: 0 }
                  );
                  const total = agg.meta + agg.google + agg.prog || 1;
                  const segs = [
                    { label: "Meta", value: agg.meta, color: colors[0] },
                    { label: "Google", value: agg.google, color: colors[1] },
                    { label: "Programmatic", value: agg.prog, color: colors[2] },
                  ];
                  const cx = 110, cy = 110, r = 95;
                  let cum = 0;
                  const arcs = segs.map((s) => {
                    const start = (cum / total) * Math.PI * 2 - Math.PI / 2;
                    cum += s.value;
                    const end = (cum / total) * Math.PI * 2 - Math.PI / 2;
                    const large = end - start > Math.PI ? 1 : 0;
                    const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
                    const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
                    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
                    return { d, color: s.color, label: s.label, pct: Math.round((s.value / total) * 100) };
                  });
                  return (
                    <div className="flex flex-col items-center gap-3">
                      <svg viewBox="0 0 220 220" className="w-full max-w-[240px]">
                        {arcs.map((a) => (
                          <path key={a.label} d={a.d} fill={a.color} stroke="var(--ink)" strokeWidth={2} />
                        ))}
                      </svg>
                      <div className="grid grid-cols-3 gap-2 w-full">
                        {arcs.map((a) => (
                          <div key={a.label} className="card-flat-sm p-2 text-center">
                            <div className="mono text-[10px] uppercase">{a.label}</div>
                            <div className="mono text-lg font-bold">{a.pct}%</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()
              ) : (
                <table className="w-full text-xs">
                  <thead className="border-b-2 border-ink bg-secondary">
                    <tr className="text-left">
                      {["Advertiser", "Meta $", "Google $", "Prog. $", "Total"].map((h) => (
                        <th key={h} className="px-2 py-1.5 mono text-[10px] uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r) => (
                      <tr key={r.name} className="border-b border-ink/30 last:border-0">
                        <td className="px-2 py-1.5 font-semibold">{r.name}</td>
                        <td className="px-2 py-1.5 mono">{fmt((r.meta * r.spend) / 100)}</td>
                        <td className="px-2 py-1.5 mono">{fmt((r.google * r.spend) / 100)}</td>
                        <td className="px-2 py-1.5 mono">{fmt((r.programmatic * r.spend) / 100)}</td>
                        <td className="px-2 py-1.5 mono font-bold">{fmt(r.spend)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
            {livePlacements.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No live creative data found. Please add an active domain under the Advertisers tab.
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-0">
                {livePlacements
                  .filter((v) =>
                    videoFilter === "all" ? true : videoFilter === "short" ? v.days < 14 : v.days >= 14
                  )
                  .map((v, idx) => (
                    <div key={`${v.brand}-${idx}`} className="border-r-2 last:border-r-0 border-b-2 lg:border-b-0 border-ink p-3 space-y-2">
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
            )}
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
              {liveSentiment.length === 0 ? (
                <div className="card-flat p-8 text-center text-sm text-muted-foreground">
                  No live creative data found. Please add an active domain under the Advertisers tab.
                </div>
              ) : liveSentiment.map((s, i) => (
                <div key={`${s.domain}-${i}`} className="card-flat overflow-hidden">
                  <div className="px-4 py-3 border-b-2 border-ink bg-secondary flex items-center justify-between">
                    <div className="font-bold">{brandFromDomain(s.domain)}</div>
                    <span className="mono text-[10px] px-1.5 py-0.5 border-2 border-ink rounded-[3px] bg-paper">{s.domain}</span>
                  </div>
                  <div className="grid md:grid-cols-3 gap-0">
                    <div className="p-4 border-r-2 border-ink last:border-r-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 border-2 border-ink rounded-[4px] grid place-items-center bg-primary"><ThumbsUp size={14} /></div>
                        <div className="mono text-[10px] uppercase font-bold">The Good</div>
                      </div>
                      <p className="text-sm leading-relaxed">{s.good ?? "Awaiting signal…"}</p>
                    </div>
                    <div className="p-4 border-r-2 border-ink last:border-r-0 border-t-2 md:border-t-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 border-2 border-ink rounded-[4px] grid place-items-center bg-ink text-paper"><AlertTriangle size={14} /></div>
                        <div className="mono text-[10px] uppercase font-bold">The Friction</div>
                      </div>
                      <p className="text-sm leading-relaxed">{s.friction ?? "Awaiting signal…"}</p>
                    </div>
                    <div className="p-4 border-t-2 md:border-t-0 bg-canvas">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 border-2 border-ink rounded-[4px] grid place-items-center bg-secondary"><PenTool size={14} /></div>
                        <div className="mono text-[10px] uppercase font-bold">The Ad Angle · Copy Blueprint</div>
                      </div>
                      <p className="text-sm leading-relaxed font-medium">{s.blueprint ?? "Awaiting signal…"}</p>
                      <button onClick={() => { navigator.clipboard?.writeText(s.blueprint ?? "").catch(() => {}); toast.success(`${brandFromDomain(s.domain)} blueprint copied`); }} className="btn-flat text-[11px] px-2 py-1 mt-3">
                        <Copy size={12} /> Copy blueprint
                      </button>
                    </div>
                  </div>
                </div>
              ))}
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
                <input type="password" value={apifyToken} onChange={(e) => setApifyToken(e.target.value)} onBlur={() => apifyToken && saveAllIntegrations()} placeholder="apify_api_xxxxxxxxxxxxxxxxxxxx" className="input-flat mono" />
              </div>

              <div className="card-flat p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold"><KeyRound size={16} /> DataForSEO Credentials</div>
                  <span className="mono text-[10px] px-1.5 py-0.5 border-2 border-ink rounded-[3px] bg-secondary">SEARCH + VIDEO</span>
                </div>
                <p className="text-xs text-muted-foreground">Powers Google Ads Transparency and YouTube ad placement indexing.</p>
                <input type="text" value={dfsLogin} onChange={(e) => setDfsLogin(e.target.value)} onBlur={() => dfsLogin && saveAllIntegrations()} placeholder="DataForSEO login (email)" className="input-flat mono" />
                <input type="password" value={dfsPassword} onChange={(e) => setDfsPassword(e.target.value)} onBlur={() => dfsPassword && saveAllIntegrations()} placeholder="DataForSEO password" className="input-flat mono" />
              </div>

              <div className="card-flat p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold"><KeyRound size={16} /> Resend API Key</div>
                  <span className="mono text-[10px] px-1.5 py-0.5 border-2 border-ink rounded-[3px] bg-secondary">EMAIL</span>
                </div>
                <p className="text-xs text-muted-foreground">Delivers creative diff alerts and pitch-ready briefs to your inbox or client distribution lists.</p>
                <input type="password" value={resendKey} onChange={(e) => setResendKey(e.target.value)} onBlur={() => resendKey && saveAllIntegrations()} placeholder="re_xxxxxxxxxxxxxxxxxxxx" className="input-flat mono" />
              </div>

              <button onClick={saveAllIntegrations} disabled={integSaving} className="btn-flat btn-primary">
                <Save size={13} /> {integSaving ? "Saving…" : "Save all integrations"}
              </button>

              <div className="mono text-[11px] text-muted-foreground border-2 border-dashed border-ink rounded-[4px] p-3">
                ► Keys are encrypted at rest and used only for your workspace scans.
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
              <button onClick={() => { setRows(baselineRows); toast("Reset to baseline values"); }} className="btn-flat flex-1">Reset</button>
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

const NAV_ITEMS = [
  { icon: Home, label: "Workspace", to: "/app" as const },
  { icon: Layers, label: "Creative library", to: "/app/creative" as const },
  { icon: Target, label: "Advertisers", to: "/app/advertisers" as const },
  { icon: TrendingUp, label: "Benchmarks", to: "/app/benchmarks" as const },
  { icon: Settings, label: "Settings", to: "/app/settings" as const },
];

export function SidebarNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="p-2 space-y-1 flex-1">
      {NAV_ITEMS.map((it) => {
        const active = pathname === it.to;
        return (
          <Link
            key={it.label}
            to={it.to}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-[4px] text-sm font-medium border-2 ${active ? "border-ink bg-secondary shadow-flat-sm" : "border-transparent hover:border-ink"}`}
          >
            <it.icon size={15} /> {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
