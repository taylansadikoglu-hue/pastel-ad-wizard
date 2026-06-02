import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useTheme } from "./theme";
import {
  Palette, FileDown, Table as TableIcon, Copy, Sliders, Send, Sparkles,
  Home, Layers, Target, Settings, LogOut, MessageSquare, X, Search,
  TrendingUp, Clock, Activity,
} from "lucide-react";

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
  const [chatLog, setChatLog] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "ai", text: "Hi Ava — ask me anything about the tracked advertisers' creative." },
  ]);

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
            <span className="mono text-xs font-bold">AP</span>
          </div>
          <div>
            <div className="font-bold leading-tight">AdPalette</div>
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
        </main>
      </div>

      {/* Calibrate drawer */}
      {calibOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-ink/40" onClick={() => setCalibOpen(false)} />
          <div className="w-[420px] bg-paper border-l-2 border-ink h-full flex flex-col">
            <div className="px-5 py-4 border-b-2 border-ink flex items-center justify-between">
              <div>
                <div className="font-bold">Calibrate spend model</div>
                <div className="mono text-[10px] text-muted-foreground">Override scraped estimates · channel % stays fixed</div>
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
              <button onClick={() => { setRows(INITIAL); toast("Reset to scraped values"); }} className="btn-flat flex-1">Reset</button>
              <button onClick={() => { setCalibOpen(false); toast.success("Spend model calibrated"); }} className="btn-flat btn-primary flex-1">Save model</button>
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
    return `Across ${visible.length} rivals, weighted channel mix is ~${meta}% Meta, the rest split between Google and programmatic. Glossier is the most social-heavy.`;
  }
  if (/hook/i.test(q)) {
    return `Dominant hook patterns: 1) UGC unboxing (Sephora), 2) minimalist product hero (Lululemon), 3) founder-led story (Glossier). Pain-point hooks underused — opportunity.`;
  }
  return `Tracked rivals account for ~$${(total/1_000_000).toFixed(2)}M in monthly spend. Ask about channel mix, hooks, or ad longevity.`;
}
