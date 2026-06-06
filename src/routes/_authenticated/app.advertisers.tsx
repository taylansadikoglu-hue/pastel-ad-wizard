import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Film, Image as ImageIcon, Filter } from "lucide-react";
import { WorkspaceShell } from "@/components/adpalette/WorkspaceShell";
import { supabase } from "@/integrations/supabase/client";
import { startScan } from "@/lib/scan.functions";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

const MAX_BRANDS = 7;

type Row = { id: string; domain: string; status: string; created_at: string };

type Placement = {
  id: string;
  domain: string;
  channel: string;
  hook: string | null;
  days_running: number | null;
  creative_url: string | null;
  raw: unknown;
  created_at: string;
};

type MediaKind = "video" | "image" | "iframe" | "none";

function brandFromDomain(domain: string) {
  const root =
    domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[./]/)[0] ?? domain;
  return root.charAt(0).toUpperCase() + root.slice(1);
}

function normalizeChannel(c: string): "Meta" | "Google" | "TikTok" | "Programmatic" {
  const k = (c || "").toLowerCase();
  if (k.includes("meta") || k.includes("facebook") || k.includes("instagram")) return "Meta";
  if (k.includes("google") || k.includes("youtube") || k.includes("search")) return "Google";
  if (k.includes("tiktok")) return "TikTok";
  return "Programmatic";
}

function extractMediaUrl(
  creative: unknown,
  raw: unknown,
): { url: string | null; type: MediaKind } {
  const classify = (u: string, keyHint = ""): "video" | "image" | "iframe" => {
    const lo = u.toLowerCase();
    const key = keyHint.toLowerCase();
    if (key.includes("video")) return "video";
    if (key.includes("image") || key.includes("picture") || key.includes("thumbnail"))
      return "image";
    if (/\.(mp4|mov|webm|m3u8)(\?|$)/.test(lo)) return "video";
    if (/\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/.test(lo)) return "image";
    return "iframe";
  };
  const collect = (
    val: unknown,
    depth = 0,
    keyHint = "",
  ): { url: string; type: "video" | "image" | "iframe" }[] => {
    if (!val || depth > 6) return [];
    if (typeof val === "string")
      return /^https?:\/\//.test(val) ? [{ url: val, type: classify(val, keyHint) }] : [];
    if (Array.isArray(val)) return val.flatMap((v) => collect(v, depth + 1, keyHint));
    if (typeof val === "object") {
      const obj = val as Record<string, unknown>;
      const order = [
        "video_hd_url",
        "video_sd_url",
        "video_url",
        "video",
        "image_url",
        "original_image_url",
        "resized_image_url",
        "thumbnail_url",
        "picture",
        "image",
        "url",
        "src",
        "href",
      ];
      const ordered = order.filter((k) => k in obj);
      const rest = Object.keys(obj).filter((k) => !ordered.includes(k));
      return [...ordered, ...rest].flatMap((k) => collect(obj[k], depth + 1, k));
    }
    return [];
  };
  const a = collect(raw);
  const b = collect(creative);
  const direct = [...a, ...b].find((c) => c.type === "video" || c.type === "image");
  const fallback = [...b, ...a].find(Boolean);
  return direct ?? fallback ?? { url: null, type: "none" };
}

function adType(p: Placement, mediaType: MediaKind): "Video" | "Image" | "Carousel" | "Other" {
  const r = p.raw as Record<string, unknown> | null;
  if (r && typeof r === "object") {
    const t = String(
      (r as Record<string, unknown>).ad_type ??
        (r as Record<string, unknown>).type ??
        "",
    ).toLowerCase();
    if (t.includes("carousel")) return "Carousel";
    if (t.includes("video")) return "Video";
    if (t.includes("image") || t.includes("photo")) return "Image";
  }
  if (mediaType === "video") return "Video";
  if (mediaType === "image") return "Image";
  return "Other";
}

function MediaEmbed({
  url,
  type,
  title,
}: {
  url: string | null;
  type: MediaKind;
  title: string;
}) {
  if (!url || type === "none") {
    return (
      <div className="aspect-video w-full bg-secondary border-b-2 border-ink flex items-center justify-center text-xs text-muted-foreground mono">
        No media
      </div>
    );
  }
  if (type === "video") {
    return (
      <video
        controls
        preload="metadata"
        className="aspect-video w-full bg-black border-b-2 border-ink object-contain"
        src={url}
      />
    );
  }
  if (type === "image") {
    return (
      <img
        src={url}
        alt={title}
        loading="lazy"
        className="aspect-video w-full object-cover border-b-2 border-ink bg-secondary"
      />
    );
  }
  return (
    <iframe
      src={url}
      title={title}
      loading="lazy"
      className="aspect-video w-full border-b-2 border-ink bg-secondary"
      sandbox="allow-scripts allow-same-origin"
    />
  );
}

function AdvertisersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [input, setInput] = useState("");
  const [country, setCountry] = useState<"United States" | "Australia" | "United Kingdom" | "Canada">("United States");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  // filters
  const [channelFilter, setChannelFilter] = useState<string>("All");
  const [adTypeFilter, setAdTypeFilter] = useState<string>("All");
  const [flightFilter, setFlightFilter] = useState<"all" | "short" | "long">("all");
  const [sortBy, setSortBy] = useState<"recent" | "longest" | "shortest">("recent");
  const [activeAdvertiser, setActiveAdvertiser] = useState<string>("__all");

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const [{ data: scans }, { data: pls }] = await Promise.all([
      supabase
        .from("domain_scans")
        .select("id, domain, status, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("ad_placements")
        .select("id, domain, channel, hook, days_running, creative_url, raw, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    const seen = new Set<string>();
    const unique: Row[] = [];
    for (const r of scans ?? []) {
      if (!seen.has(r.domain)) {
        seen.add(r.domain);
        unique.push(r as Row);
      }
    }
    setRows(unique);
    setPlacements((pls ?? []) as Placement[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("advertisers-hub")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "domain_scans" },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ad_placements" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const normalize = (raw: string) =>
    raw
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "");

  const addDomain = async () => {
    const domain = normalize(input);
    if (!domain || !/\.[a-z]{2,}$/.test(domain)) {
      toast.error("Enter a valid domain (e.g. target.com)");
      return;
    }
    if (rows.length >= MAX_BRANDS) {
      toast.error(`Maximum ${MAX_BRANDS} tracked brands on Agency tier`);
      return;
    }
    if (rows.some((r) => r.domain === domain)) {
      toast.error("Domain already tracked");
      return;
    }
    setBusy(true);
    try {
      await startScan({ data: { domain, country } });
      setInput("");
      toast.success(`Tracking ${domain}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add domain");
    } finally {
      setBusy(false);
    }
  };

  const removeDomain = async (_id: string, domain: string) => {
    const { error } = await supabase.from("domain_scans").delete().eq("domain", domain);
    if (error) return toast.error(error.message);
    toast(`${domain} removed`);
    load();
  };

  // Enriched placements w/ derived fields
  const enriched = useMemo(() => {
    return placements.map((p) => {
      const media = extractMediaUrl(p.creative_url, p.raw);
      return {
        ...p,
        brand: brandFromDomain(p.domain),
        channelNorm: normalizeChannel(p.channel),
        media,
        adType: adType(p, media.type),
        days: p.days_running ?? 0,
      };
    });
  }, [placements]);

  const advertisers = useMemo(() => {
    const set = new Map<string, { domain: string; brand: string; count: number }>();
    for (const e of enriched) {
      const prev = set.get(e.domain) ?? { domain: e.domain, brand: e.brand, count: 0 };
      prev.count += 1;
      set.set(e.domain, prev);
    }
    // also include tracked rows even if no placements
    for (const r of rows) {
      if (!set.has(r.domain))
        set.set(r.domain, { domain: r.domain, brand: brandFromDomain(r.domain), count: 0 });
    }
    return Array.from(set.values()).sort((a, b) => b.count - a.count);
  }, [enriched, rows]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (activeAdvertiser !== "__all") list = list.filter((e) => e.domain === activeAdvertiser);
    if (channelFilter !== "All") list = list.filter((e) => e.channelNorm === channelFilter);
    if (adTypeFilter !== "All") list = list.filter((e) => e.adType === adTypeFilter);
    if (flightFilter === "short") list = list.filter((e) => e.days < 14);
    if (flightFilter === "long") list = list.filter((e) => e.days >= 14);
    list = [...list].sort((a, b) => {
      if (sortBy === "longest") return b.days - a.days;
      if (sortBy === "shortest") return a.days - b.days;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return list;
  }, [enriched, activeAdvertiser, channelFilter, adTypeFilter, flightFilter, sortBy]);

  const channelCounts = useMemo(() => {
    const base = { Meta: 0, Google: 0, TikTok: 0, Programmatic: 0 } as Record<string, number>;
    for (const e of enriched) {
      if (activeAdvertiser !== "__all" && e.domain !== activeAdvertiser) continue;
      base[e.channelNorm] = (base[e.channelNorm] ?? 0) + 1;
    }
    return base;
  }, [enriched, activeAdvertiser]);

  return (
    <WorkspaceShell
      title="Advertiser Hub"
      subtitle={`Client-ready creative compilations across ${rows.length}/${MAX_BRANDS} tracked brands.`}
    >
      <div className="space-y-5">
        {/* Add brand */}
        <div className="card-flat p-4">
          <label className="mono text-[10px] uppercase font-bold block mb-2">
            Add Competitor Domain (e.g., target.com)
          </label>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addDomain()}
              placeholder="competitor.com"
              className="input-flat mono flex-1"
              disabled={busy || rows.length >= MAX_BRANDS}
            />
            <button
              onClick={addDomain}
              disabled={busy || rows.length >= MAX_BRANDS}
              className="btn-flat btn-primary"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add brand
            </button>
          </div>
        </div>

        {/* Tracked brands strip */}
        {rows.length > 0 && (
          <div className="card-flat overflow-hidden">
            <div className="px-4 py-3 border-b-2 border-ink bg-secondary mono text-[10px] uppercase font-bold">
              Tracked brands
            </div>
            <div className="flex flex-wrap gap-2 p-3">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-2 border-2 border-ink rounded-[3px] bg-paper px-2 py-1"
                >
                  <span className="font-semibold text-sm">{brandFromDomain(r.domain)}</span>
                  <span className="mono text-[10px] text-muted-foreground">{r.domain}</span>
                  <span className="mono text-[10px] px-1.5 py-0.5 border border-ink/40 rounded-[3px]">
                    {r.status}
                  </span>
                  <button
                    onClick={() => removeDomain(r.id, r.domain)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${r.domain}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Advertiser tabs */}
        <Tabs value={activeAdvertiser} onValueChange={setActiveAdvertiser}>
          <div className="card-flat p-3">
            <TabsList className="flex flex-wrap h-auto bg-secondary">
              <TabsTrigger value="__all" className="mono text-[11px] uppercase">
                All ({enriched.length})
              </TabsTrigger>
              {advertisers.map((a) => (
                <TabsTrigger
                  key={a.domain}
                  value={a.domain}
                  className="mono text-[11px] uppercase"
                >
                  {a.brand} ({a.count})
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Filter bar */}
          <div className="card-flat p-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 mono text-[10px] uppercase font-bold mr-2">
              <Filter size={12} /> Filters
            </div>

            <div className="flex items-center gap-1">
              {(["All", "Meta", "Google", "TikTok", "Programmatic"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setChannelFilter(c)}
                  className={`btn-flat text-[11px] px-2 py-1 ${channelFilter === c ? "btn-primary" : ""}`}
                >
                  {c}
                  {c !== "All" && (
                    <span className="ml-1 mono text-[10px] opacity-70">
                      {channelCounts[c] ?? 0}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="mx-2 h-5 w-px bg-ink/30" />

            <select
              value={adTypeFilter}
              onChange={(e) => setAdTypeFilter(e.target.value)}
              className="input-flat mono text-[11px] py-1"
            >
              <option value="All">All ad types</option>
              <option value="Video">Video</option>
              <option value="Image">Image</option>
              <option value="Carousel">Carousel</option>
              <option value="Other">Other</option>
            </select>

            <div className="flex items-center gap-1">
              {([
                { v: "all", l: "All flights" },
                { v: "short", l: "< 14 days" },
                { v: "long", l: "14+ days" },
              ] as const).map((f) => (
                <button
                  key={f.v}
                  onClick={() => setFlightFilter(f.v)}
                  className={`btn-flat text-[11px] px-2 py-1 ${flightFilter === f.v ? "btn-primary" : ""}`}
                >
                  {f.l}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <span className="mono text-[10px] uppercase text-muted-foreground">Sort</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="input-flat mono text-[11px] py-1"
              >
                <option value="recent">Most recent</option>
                <option value="longest">Longest flight</option>
                <option value="shortest">Shortest flight</option>
              </select>
            </div>
          </div>

          {/* Grid */}
          <TabsContent value={activeAdvertiser} className="mt-3">
            {loading ? (
              <div className="card-flat p-10 text-center text-sm text-muted-foreground">
                Loading creatives…
              </div>
            ) : filtered.length === 0 ? (
              <div className="card-flat p-10 text-center text-sm text-muted-foreground">
                No creatives match these filters yet. Run a scan or relax filters.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filtered.map((e) => (
                  <article
                    key={e.id}
                    className="card-flat overflow-hidden flex flex-col"
                  >
                    <MediaEmbed
                      url={e.media.url}
                      type={e.media.type}
                      title={e.hook ?? e.brand}
                    />
                    <div className="p-3 space-y-2 flex-1 flex flex-col">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm truncate">{e.brand}</span>
                        <span className="mono text-[10px] px-1.5 py-0.5 border-2 border-ink rounded-[3px] bg-paper">
                          {e.channelNorm}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-3 min-h-[2.5rem]">
                        {e.hook ?? "—"}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-2 border-t border-ink/20">
                        <span className="mono text-[10px] px-1.5 py-0.5 border border-ink/40 rounded-[3px] inline-flex items-center gap-1">
                          {e.adType === "Video" ? <Film size={10} /> : <ImageIcon size={10} />}
                          {e.adType}
                        </span>
                        <span
                          className={`mono text-[10px] px-1.5 py-0.5 border rounded-[3px] ${
                            e.days >= 14
                              ? "border-ink bg-secondary"
                              : "border-ink/40"
                          }`}
                        >
                          {e.days}d flight
                        </span>
                        <span className="mono text-[10px] text-muted-foreground ml-auto">
                          {new Date(e.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </WorkspaceShell>
  );
}

export const Route = createFileRoute("/_authenticated/app/advertisers")({
  head: () => ({ meta: [{ title: "Advertiser Hub — RevenueAd" }] }),
  component: AdvertisersPage,
});
