import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useTheme } from "./theme";
import { supabase } from "@/integrations/supabase/client";
import {
  Palette, FileDown, Table as TableIcon, Copy, Sliders, Send, Sparkles,
  Home, Layers, Target, Settings, LogOut, MessageSquare, X, Search,
  TrendingUp, Clock, Activity, Calendar, ChevronDown, Lock, Play, Film,
  Grid3x3, Radio,
  BarChart3, PieChart as PieIcon, Loader2,
} from "lucide-react";

// Safely coerce any DB value to a renderable string — kills "[object Object]"
// leaks from raw JSONB columns that older rows may have written.
function safeText(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try { return JSON.stringify(v); } catch { return fallback; }
}

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

// Pull a usable media URL out of creative_url (which may be a string OR a JSON object)
// or fall back to scanning the raw scrape payload.
function extractMediaUrl(
  creative: unknown,
  raw: unknown,
): { url: string | null; type: "video" | "image" | "iframe" | "none" } {
  const classify = (u: string, keyHint = ""): "video" | "image" | "iframe" => {
    const lo = u.toLowerCase();
    const key = keyHint.toLowerCase();
    if (key.includes("video")) return "video";
    if (key.includes("image") || key.includes("picture") || key.includes("thumbnail")) return "image";
    if (/\.(mp4|mov|webm|m3u8)(\?|$)/.test(lo)) return "video";
    if (/\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/.test(lo)) return "image";
    return "iframe";
  };
  const collect = (val: unknown, depth = 0, keyHint = ""):
    { url: string; type: "video" | "image" | "iframe" }[] => {
    if (!val || depth > 6) return [];
    if (typeof val === "string") {
      return /^https?:\/\//.test(val) ? [{ url: val, type: classify(val, keyHint) }] : [];
    }
    if (Array.isArray(val)) {
      return val.flatMap((v) => collect(v, depth + 1, keyHint));
    }
    if (typeof val === "object") {
      const obj = val as Record<string, unknown>;
      const keyOrder = ["video_hd_url", "video_sd_url", "video_url", "video", "image_url", "original_image_url", "resized_image_url", "thumbnail_url", "picture", "image", "url", "src", "href"];
      const ordered = keyOrder.filter((k) => k in obj);
      const remaining = Object.keys(obj).filter((k) => !ordered.includes(k));
      return [...ordered, ...remaining].flatMap((k) => collect(obj[k], depth + 1, k));
    }
    return [];
  };
  const rawCandidates = collect(raw);
  const creativeCandidates = collect(creative);
  const direct = [...rawCandidates, ...creativeCandidates].find((c) => c.type === "video" || c.type === "image");
  const fallback = [...creativeCandidates, ...rawCandidates].find(Boolean);
  if (direct) return direct;
  if (fallback) return fallback;
  return { url: null, type: "none" };
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
  const [adTypeFilter, setAdTypeFilter] = useState<"All" | "Video" | "Image">("All");
  const [channelFilter, setChannelFilter] = useState<"All" | "Meta" | "Google">("All");
  const [creativeSort, setCreativeSort] = useState<"recent" | "longest" | "format">("recent");
  const [chartView, setChartView] = useState<"bar" | "pie" | "table">("pie");
  const [creativeViewActive, setCreativeViewActive] = useState(false);
  const [channelFocus, setChannelFocus] = useState<null | "Meta" | "Google Search" | "Digital Video" | "Programmatic Display">(null);
  const [livePlacements, setLivePlacements] = useState<{ brand: string; hook: string; channel: string; channelNorm: "Meta" | "Google"; adType: "Video" | "Image" | "Other"; days: number; length: string; aiTag: string; mediaUrl: string | null; mediaType: "video" | "image" | "iframe" | "none"; createdAt: string | null }[]>([]);
  const [runningScans, setRunningScans] = useState<string[]>([]);
  const [userName, setUserName] = useState<string>("");
  const [userInitials, setUserInitials] = useState<string>("YOU");
  const [userEmail, setUserEmail] = useState<string>("");
  const [agencyDomain, setAgencyDomain] = useState<string>("");
  const [chatLog, setChatLog] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "ai", text: "Welcome — ask me anything about the tracked advertisers' creative." },
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const exportRef = useRef<HTMLDivElement>(null);

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

  // Track in-flight domain scans → drives skeleton banner.
  // One-shot load on mount; no polling loop, no realtime resubscription —
  // avoids flashing the dashboard every few seconds.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("domain_scans")
        .select("domain, status")
        .in("status", ["queued", "running"]);
      if (active) setRunningScans((data ?? []).map((r) => r.domain));
    })();
    return () => { active = false; };
  }, []);

  // Continuous Inspiration Loop → ad_placements (channel = Meta/Google, ad_type = Image/Video)
  // One-shot fetch on mount. We intentionally do NOT subscribe to postgres_changes
  // or poll on an interval here — those caused the grid to flash and reset
  // checkbox interactions whenever the scraper inserted a row.
  useEffect(() => {
    let active = true;
    const normalizeChan = (c: string | null): "Meta" | "Google" => {
      const k = (c ?? "").toLowerCase();
      if (k.includes("google") || k.includes("youtube") || k.includes("search")) return "Google";
      return "Meta";
    };
    const normalizeType = (t: string | null, mt: "video" | "image" | "iframe" | "none"): "Video" | "Image" | "Other" => {
      const k = (t ?? "").toLowerCase();
      if (k.includes("video")) return "Video";
      if (k.includes("image") || k.includes("photo")) return "Image";
      if (mt === "video") return "Video";
      if (mt === "image") return "Image";
      return "Other";
    };
    (async () => {
      const { data, error } = await supabase
        .from("ad_placements")
        .select("domain, channel, ad_type, hook, days_running, creative_url, raw, created_at")
        .order("created_at", { ascending: false })
        .limit(48);
      if (error) {
        console.error("[ad_placements] query failed", error);
        return;
      }
      if (!active || !data) return;
      setLivePlacements(data.map((p) => {
        const extracted = extractMediaUrl(p.creative_url, p.raw);
        const hookText = safeText(p.hook, "").trim() || "Live creative — hook pending AI extraction.";
        const chan = normalizeChan(p.channel);
        return {
          brand: brandFromDomain(safeText(p.domain)),
          hook: hookText,
          channel: safeText(p.channel, chan),
          channelNorm: chan,
          adType: normalizeType(p.ad_type, extracted.type),
          days: typeof p.days_running === "number" ? p.days_running : 1,
          length: "0:--",
          aiTag: "Live",
          mediaUrl: extracted.url,
          mediaType: extracted.type,
          createdAt: p.created_at ?? null,
        };
      }));
    })();
    return () => { active = false; };
  }, []);




  // Derive spend from live placements: Google Search × $150 + Digital Video × $450.
  // Falls back to baseline synthetic spend only when zero placements exist for a brand.
  const placementSpend = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of livePlacements) {
      let inc = 0;
      if (p.channelNorm === "Google" && p.adType === "Video") inc = 450;
      else if (p.channelNorm === "Google") inc = 150;
      else if (p.channelNorm === "Meta") inc = p.adType === "Video" ? 450 : 150;
      // Programmatic Display fallback uses search-tier proxy
      else inc = 150;
      map.set(p.brand, (map.get(p.brand) ?? 0) + inc);
    }
    return map;
  }, [livePlacements]);

  const displayRows = useMemo(
    () => rows.map((r) => ({ ...r, spend: placementSpend.get(r.name) ?? r.spend })),
    [rows, placementSpend],
  );
  const visible = displayRows.filter((r) => selected[r.name]);
  const colors = theme === "dark" ? CHANNEL_COLORS_PASTEL : CHANNEL_COLORS_STD;
  const totalSpend = useMemo(() => visible.reduce((a, b) => a + b.spend, 0), [visible]);
  const focusedBrand = visible[0]?.name ?? displayRows[0]?.name ?? "";
  const sentimentScores = useMemo(() => sentimentForBrand(focusedBrand), [focusedBrand]);

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


  const exportCSV = () => {
    const esc = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const sections: string[] = [];
    sections.push("ADVERTISER MATRIX");
    sections.push(["Advertiser", "Est monthly spend", "Meta %", "Google %", "Programmatic %"].join(","));
    for (const r of rows) sections.push([r.name, r.spend, r.meta, r.google, r.programmatic].map(esc).join(","));
    sections.push("");
    sections.push("CONTINUOUS INSPIRATION LOOP");
    sections.push(["Brand", "Channel", "Hook", "Flight days", "Media URL"].join(","));
    for (const p of livePlacements) sections.push([p.brand, p.channel, p.hook, p.days, p.mediaUrl ?? ""].map(esc).join(","));
    const blob = new Blob([sections.join("\n")], { type: "text/csv;charset=utf-8" });
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

  const exportPDF = async () => {
    const node = exportRef.current;
    if (!node) {
      toast.error("Nothing to export yet");
      return;
    }
    try {
      toast("Generating pitch PDF…");
      const mod = await import("html2pdf.js");
      const html2pdf = (mod as { default: (...args: unknown[]) => unknown }).default ?? (mod as unknown as (...args: unknown[]) => unknown);
      await (html2pdf as (...args: unknown[]) => { set: (opts: unknown) => { from: (el: HTMLElement) => { save: () => Promise<void> } } })()
        .set({
          margin: 10,
          filename: `revenuead-pitch-${new Date().toISOString().slice(0, 10)}.pdf`,
          image: { type: "jpeg", quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
          jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
        })
        .from(node)
        .save();
      toast.success("Pitch PDF downloaded");
    } catch (e) {
      console.error("PDF export failed", e);
      toast.error("PDF export failed — falling back to print dialog");
      window.print();
    }
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
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm"
                placeholder="Search creative, hooks, advertisers..."
              />
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
          {runningScans.length > 0 && (
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
              <h1 className="text-2xl font-bold mt-1">Media mix & share of voice matrix</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Channel allocation pulled from {visible.length} of {rows.length} tracked advertisers. Recalibrate any total below.
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn-flat" onClick={exportPDF}>
                <FileDown size={14} /> Export pitch PDF
              </button>
              <button className="btn-flat" onClick={exportCSV}>
                <TableIcon size={14} /> Export CSV
              </button>
              <button className="btn-flat" onClick={() => { navigator.clipboard?.writeText("chart").catch(() => {}); toast.success("Chart asset copied to clipboard"); }}>
                <Copy size={14} /> Copy chart asset
              </button>
            </div>
          </div>

          <div ref={exportRef} className="space-y-6">
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
                    {displayRows.map((r) => {
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

            {/* Chart — aggregate market footprint grouped by channel + ad_type */}
            <div className="card-flat p-4">
              {(() => {
                const groups = { Meta: 0, "Google Search": 0, "Digital Video": 0, "Programmatic Display": 0 } as Record<string, number>;
                for (const p of livePlacements) {
                  if (p.channelNorm === "Meta") groups.Meta += 1;
                  else if (p.channelNorm === "Google" && p.adType === "Video") groups["Digital Video"] += 1;
                  else if (p.channelNorm === "Google") groups["Google Search"] += 1;
                  else groups["Programmatic Display"] += 1;
                }
                const total = Object.values(groups).reduce((a, b) => a + b, 0);
                const segs = (Object.keys(groups) as Array<keyof typeof groups>).map((k, i) => ({
                  label: k as "Meta" | "Google Search" | "Digital Video" | "Programmatic Display",
                  count: groups[k],
                  pct: total ? Math.round((groups[k] / total) * 100) : 0,
                  color: ["var(--primary)", "#23251D", "#A1A39A", "var(--pastel-peach)"][i],
                }));
                const focusSector = (label: typeof segs[number]["label"]) => {
                  setChannelFocus((cur) => (cur === label ? null : label));
                  setCreativeViewActive(true);
                };
                return (
                  <>
                    <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                      <div>
                        <div className="font-bold text-sm">Channel allocation · market footprint</div>
                        <div className="mono text-[10px] text-muted-foreground">{total} live placements across all tracked advertisers · click a sector to drill in</div>
                      </div>
                      <div className="flex items-center border-2 border-ink rounded-[3px] overflow-hidden">
                        {([
                          { k: "pie", label: "Pie", icon: PieIcon },
                          { k: "bar", label: "Bars", icon: BarChart3 },
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
                    <div className="flex flex-wrap items-center gap-2 mono text-[10px] mb-3">
                      {segs.map((s) => (
                        <button
                          key={s.label}
                          onClick={() => focusSector(s.label)}
                          className={`flex items-center gap-1 px-1.5 py-0.5 border-2 rounded-[3px] ${channelFocus === s.label ? "border-ink bg-secondary" : "border-transparent hover:border-ink"}`}
                        >
                          <span className="w-3 h-3 border-2 border-ink" style={{ background: s.color }} />{s.label}
                        </button>
                      ))}
                    </div>
                    {total === 0 ? (
                      <div className="h-64 grid place-items-center mono text-xs text-muted-foreground border-2 border-dashed border-ink rounded-[4px]">
                        No live placements ingested yet
                      </div>
                    ) : chartView === "bar" ? (
                      <div className="space-y-3">
                        {segs.map((s) => (
                          <button key={s.label} onClick={() => focusSector(s.label)} className="w-full text-left">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="font-semibold">{s.label}</span>
                              <span className="mono text-muted-foreground">{s.count} · {s.pct}%</span>
                            </div>
                            <div className={`h-7 border-2 rounded-[3px] overflow-hidden bg-paper ${channelFocus === s.label ? "border-primary" : "border-ink"}`}>
                              <div style={{ width: `${s.pct}%`, background: s.color }} className="h-full" />
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : chartView === "pie" ? (
                      (() => {
                        const cx = 110, cy = 110, r = 95;
                        let cum = 0;
                        const arcs = segs.filter((s) => s.count > 0).map((s) => {
                          const start = (cum / total) * Math.PI * 2 - Math.PI / 2;
                          cum += s.count;
                          const end = (cum / total) * Math.PI * 2 - Math.PI / 2;
                          const large = end - start > Math.PI ? 1 : 0;
                          const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
                          const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
                          const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
                          return { d, color: s.color, label: s.label, pct: s.pct };
                        });
                        return (
                          <div className="flex flex-col items-center gap-3">
                            <svg viewBox="0 0 220 220" className="w-full max-w-[240px]">
                              {arcs.map((a) => (
                                <path
                                  key={a.label}
                                  d={a.d}
                                  fill={a.color}
                                  stroke="var(--ink)"
                                  strokeWidth={channelFocus === a.label ? 4 : 2}
                                  style={{ cursor: "pointer", opacity: channelFocus && channelFocus !== a.label ? 0.45 : 1 }}
                                  onClick={() => focusSector(a.label)}
                                />
                              ))}
                            </svg>
                            <div className="grid grid-cols-2 gap-2 w-full">
                              {segs.map((a) => (
                                <button
                                  key={a.label}
                                  onClick={() => focusSector(a.label)}
                                  className={`card-flat-sm p-2 text-center hover:bg-secondary ${channelFocus === a.label ? "bg-primary" : ""}`}
                                >
                                  <div className="mono text-[10px] uppercase">{a.label}</div>
                                  <div className="mono text-lg font-bold">{a.pct}%</div>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <table className="w-full text-xs">
                        <thead className="border-b-2 border-ink bg-secondary">
                          <tr className="text-left">
                            {["Channel grouping", "Placements", "Share"].map((h) => (
                              <th key={h} className="px-2 py-1.5 mono text-[10px] uppercase">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {segs.map((s) => (
                            <tr
                              key={s.label}
                              onClick={() => focusSector(s.label)}
                              className={`border-b border-ink/30 last:border-0 cursor-pointer hover:bg-secondary ${channelFocus === s.label ? "bg-primary/30" : ""}`}
                            >
                              <td className="px-2 py-1.5 font-semibold">{s.label}</td>
                              <td className="px-2 py-1.5 mono">{s.count}</td>
                              <td className="px-2 py-1.5 mono font-bold">{s.pct}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Placement Network Breakdown + Creative drawer toggle */}
          {(() => {
            const groups: Record<"Meta" | "Google Search" | "Digital Video" | "Programmatic Display", typeof livePlacements> = {
              Meta: [], "Google Search": [], "Digital Video": [], "Programmatic Display": [],
            };
            for (const p of livePlacements) {
              if (p.channelNorm === "Meta") groups.Meta.push(p);
              else if (p.channelNorm === "Google" && p.adType === "Video") groups["Digital Video"].push(p);
              else if (p.channelNorm === "Google") groups["Google Search"].push(p);
              else groups["Programmatic Display"].push(p);
            }
            const rowsData = (Object.keys(groups) as Array<keyof typeof groups>).map((label) => ({
              label,
              ads: groups[label].length,
              uniqueCreatives: new Set(groups[label].map((p) => p.mediaUrl ?? p.hook)).size,
              brands: new Set(groups[label].map((p) => p.brand)).size,
            }));
            return (
              <div className="card-flat overflow-hidden">
                <div className="px-4 py-3 border-b-2 border-ink bg-secondary flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-bold text-sm">Placement network breakdown</div>
                    <p className="text-xs text-muted-foreground mt-0.5">Where ads are running across the tracked market — click a row to inspect the creative.</p>
                  </div>
                  <label className="flex items-center gap-2 mono text-[10px] uppercase font-bold cursor-pointer select-none">
                    <span>Activate creative view</span>
                    <input
                      type="checkbox"
                      checked={creativeViewActive}
                      onChange={(e) => { setCreativeViewActive(e.target.checked); if (!e.target.checked) setChannelFocus(null); }}
                      className="w-4 h-4 accent-[var(--ink)] cursor-pointer"
                    />
                  </label>
                </div>
                <ul className="divide-y-2 divide-ink">
                  {rowsData.map((r) => (
                    <li key={r.label}>
                      <button
                        onClick={() => { setChannelFocus((cur) => (cur === r.label ? null : r.label)); setCreativeViewActive(true); }}
                        className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-secondary ${channelFocus === r.label ? "bg-primary/30" : ""}`}
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">{r.label} Network: {r.ads} ad{r.ads === 1 ? "" : "s"} found</div>
                          <div className="mono text-[10px] text-muted-foreground truncate">
                            {r.uniqueCreatives} unique creative{r.uniqueCreatives === 1 ? "" : "s"} · {r.brands} advertiser{r.brands === 1 ? "" : "s"}
                          </div>
                        </div>
                        <span className="mono text-[10px] px-2 py-1 border-2 border-ink rounded-[3px] bg-paper shrink-0">
                          {channelFocus === r.label ? "Hide creative" : "Inspect →"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}




          {/* Continuous Inspiration Loop — only visible on-demand */}
          {(creativeViewActive || channelFocus) && (
          <div className="card-flat overflow-hidden">
            <div className="px-4 py-3 border-b-2 border-ink bg-secondary flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Film size={14} /> The Continuous Inspiration Loop
                  {channelFocus && (
                    <span className="mono text-[10px] px-1.5 py-0.5 border-2 border-ink rounded-[3px] bg-primary">{channelFocus}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {channelFocus
                    ? `Showing creative captured on the ${channelFocus} network.`
                    : "Filter by ad flight length to inspect which hooks are running across the tracked market."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {channelFocus && (
                  <button onClick={() => setChannelFocus(null)} className="btn-flat text-[11px] px-2 py-1">
                    Clear channel
                  </button>
                )}
                <button onClick={() => { setCreativeViewActive(false); setChannelFocus(null); }} className="btn-flat text-[11px] px-2 py-1">
                  <X size={12} /> Close
                </button>
              </div>
            </div>
            <div className="px-4 py-2 border-b-2 border-ink flex flex-wrap items-center gap-2 bg-paper">
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
              <div className="mx-2 h-5 w-px bg-ink/30" />
              <span className="mono text-[10px] uppercase font-bold mr-1">Sort:</span>
              {([
                { k: "recent", label: "Date first seen" },
                { k: "longest", label: "Flight duration" },
                { k: "format", label: "Format" },
              ] as const).map((s) => (
                <button
                  key={s.k}
                  onClick={() => setCreativeSort(s.k)}
                  className={`btn-flat text-[11px] px-2 py-1 ${creativeSort === s.k ? "btn-primary" : ""}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {(() => {
              const selectedBrands = new Set(
                Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
              );
              const matchesChannel = (v: typeof livePlacements[number]) => {
                if (!channelFocus) return true;
                if (channelFocus === "Meta") return v.channelNorm === "Meta";
                if (channelFocus === "Digital Video") return v.channelNorm === "Google" && v.adType === "Video";
                if (channelFocus === "Google Search") return v.channelNorm === "Google" && v.adType !== "Video";
                return v.channelNorm !== "Meta" && v.channelNorm !== "Google";
              };
              const q = searchQuery.trim().toLowerCase();
              const items = livePlacements
                .filter((v) => selectedBrands.has(v.brand))
                .filter(matchesChannel)
                .filter((v) =>
                  videoFilter === "all" ? true : videoFilter === "short" ? v.days < 14 : v.days >= 14,
                )
                .filter((v) =>
                  !q
                    ? true
                    : v.brand.toLowerCase().includes(q) ||
                      v.hook.toLowerCase().includes(q) ||
                      v.channel.toLowerCase().includes(q),
                )
                .slice()
                .sort((a, b) => {
                  if (creativeSort === "longest") return b.days - a.days;
                  if (creativeSort === "format") return a.adType.localeCompare(b.adType);
                  return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
                });

              if (items.length === 0) {
                return (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No creative matches the current channel + advertiser selection.
                  </div>
                );
              }
              return (
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-0">
                  {items.map((v, idx) => {
                    const firstSeen = v.createdAt ? new Date(v.createdAt) : null;
                    const firstSeenLabel = firstSeen ? firstSeen.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";
                    return (
                    <div key={`${v.brand}-${idx}`} className="border-r-2 last:border-r-0 border-b-2 lg:border-b-0 border-ink p-3 flex flex-col gap-2 min-w-0">
                      <div className="aspect-video w-full border-2 border-ink rounded-[3px] bg-secondary grid place-items-center relative overflow-hidden shrink-0">

                        {v.mediaType === "video" && v.mediaUrl ? (
                          <video src={v.mediaUrl} className="w-full h-full object-cover" controls muted playsInline preload="metadata" />
                        ) : v.mediaType === "image" && v.mediaUrl ? (
                          <img src={v.mediaUrl} alt={`${v.brand} creative`} className="w-full h-full object-cover" loading="lazy" />
                        ) : v.mediaUrl ? (
                          <iframe src={v.mediaUrl} title={`${v.brand} creative`} className="w-full h-full border-0 bg-paper" loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups" />
                        ) : (
                          <Play size={22} />
                        )}
                        <span className="absolute bottom-1 right-1 mono text-[10px] px-1 py-0.5 border border-ink bg-paper rounded-[2px]">{v.adType}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <span className="font-semibold text-sm truncate">{v.brand}</span>
                        <span className="mono text-[10px] px-1.5 py-0.5 border-2 border-ink rounded-[3px] shrink-0 truncate max-w-[120px]">{v.channel}</span>
                      </div>
                      <p className="text-xs leading-snug line-clamp-2 min-h-[2.25rem]">{v.hook}</p>
                      <div className="mt-auto flex items-center justify-between gap-2 mono text-[10px] text-muted-foreground pt-1 border-t border-ink/30">
                        <span className="truncate">Flight: {v.days}d · First seen {firstSeenLabel}</span>
                        <button onClick={() => toast(`${v.brand} · creative opened`)} className="underline font-semibold shrink-0">Inspect →</button>
                      </div>

                    </div>
                    );
                  })}
                </div>
              );
            })()}

          </div>
          )}

          {/* Sentiment Radar — mock-fallback sentiment web tied to focused advertiser */}
          <div className="card-flat overflow-hidden">
            <div className="px-4 py-3 border-b-2 border-ink bg-secondary flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Radio size={14} /> Sentiment Radar
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Audience perception web for <span className="font-semibold">{focusedBrand || "—"}</span> across feedback, product, support, and ad-engagement axes.
                </p>
              </div>
              <span className="mono text-[10px] px-2 py-1 border-2 border-ink rounded-[3px] bg-paper">MOCK · falls back to deterministic blend</span>
            </div>
            <div className="p-5 grid md:grid-cols-[1fr_1.1fr] gap-5 items-center">
              <SentimentRadar scores={sentimentScores} />
              <div className="grid grid-cols-2 gap-2">
                {SENTIMENT_AXES.map((a, i) => (
                  <div key={a} className="card-flat-sm p-3">
                    <div className="mono text-[10px] uppercase text-muted-foreground">{a}</div>
                    <div className="mono text-2xl font-bold">{sentimentScores[i]}</div>
                    <div className="h-1.5 mt-1 border border-ink bg-paper rounded-[2px] overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${sentimentScores[i]}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>


          </div>

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

const SENTIMENT_AXES = [
  "Positive Feedback",
  "Product Quality",
  "Customer Service",
  "Ad Engagement",
] as const;

// Deterministic mock-fallback sentiment per brand so the radar stays populated
// even before a live sentiment ingestion pipeline lands.
function sentimentForBrand(name: string): number[] {
  if (!name) return [60, 60, 60, 60];
  const h = hashStr(name);
  return SENTIMENT_AXES.map((_, i) => 55 + ((h >> (i * 3)) % 40));
}

function SentimentRadar({ scores }: { scores: number[] }) {
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 30;
  const axes = SENTIMENT_AXES.length;
  const angle = (i: number) => (i / axes) * Math.PI * 2 - Math.PI / 2;
  const point = (i: number, value: number) => {
    const a = angle(i);
    const r = (value / 100) * radius;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const;
  };
  const rings = [0.25, 0.5, 0.75, 1];
  const polygon = scores.map((v, i) => point(i, v).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[280px] mx-auto">
      {rings.map((r) => (
        <polygon
          key={r}
          points={SENTIMENT_AXES.map((_, i) => point(i, r * 100).join(",")).join(" ")}
          fill="none"
          stroke="var(--ink)"
          strokeOpacity={0.25}
          strokeWidth={1}
        />
      ))}
      {SENTIMENT_AXES.map((_, i) => {
        const [x, y] = point(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--ink)" strokeOpacity={0.25} strokeWidth={1} />;
      })}
      <polygon points={polygon} fill="var(--primary)" fillOpacity={0.35} stroke="var(--ink)" strokeWidth={2} />
      {scores.map((v, i) => {
        const [x, y] = point(i, v);
        return <circle key={i} cx={x} cy={y} r={3.5} fill="var(--ink)" />;
      })}
      {SENTIMENT_AXES.map((label, i) => {
        const [x, y] = point(i, 118);
        return (
          <text
            key={label}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="mono"
            style={{ fontSize: 9, fontWeight: 700, fill: "var(--ink)" }}
          >
            {label}
          </text>
        );
      })}
    </svg>
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
  { icon: Home, label: "Dashboard / Home", href: "/app/dashboard" },
  { icon: Radio, label: "Social Listening", href: "/app/sentiment" },
  { icon: Target, label: "Advertiser Hub", href: "/app/advertisers" },
  { icon: BarChart3, label: "PCR Reporting", href: "/app/pcr" },
  
];

export function SidebarNav() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  return (
    <nav className="p-2 space-y-1 flex-1">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || (item.href === "/app/dashboard" && pathname === "/app");
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => window.location.href = item.href}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-[4px] text-sm font-medium border-2 ${active ? "border-ink bg-secondary shadow-flat-sm" : "border-transparent hover:border-ink"}`}
          >
            <item.icon size={15} /> {item.label}
          </button>
        );
      })}
    </nav>
  );
}
