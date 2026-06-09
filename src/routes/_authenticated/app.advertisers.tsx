import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Film, Image as ImageIcon, Filter, Search } from "lucide-react";
import { WorkspaceShell } from "@/components/adpalette/WorkspaceShell";
import { supabase } from "@/integrations/supabase/client";
import { startScan } from "@/lib/scan.functions";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScanStatusPill } from "@/components/adpalette/ScanStatusPill";

const MAX_BRANDS = 7;
const COUNTRY_OPTIONS = ["Australia", "United States", "United Kingdom", "Canada"] as const;

// Country-code TLD (2-letter) — excludes .au when AU is the selected market.
function isForeignToAU(domain: string): boolean {
  const m = domain.toLowerCase().match(/\.([a-z]{2})$/);
  if (!m) return false; // gTLD (.com/.net/.org/...) → keep
  return m[1] !== "au";
}

type Country = (typeof COUNTRY_OPTIONS)[number];

type Row = { id: number; domain: string; status: string; created_at: string | null };

type Placement = {
  id: number;
  domain: string;
  channel: string | null;
  ad_type: string | null;
  hook: string | null;
  days_running: number | null;
  creative_url: string | null;
  raw: unknown;
  created_at: string | null;
};

type MediaKind = "video" | "image" | "iframe" | "none";

function brandFromDomain(domain: string) {
  const root =
    domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[./]/)[0] ?? domain;
  return root.charAt(0).toUpperCase() + root.slice(1);
}

function normalizeChannel(c: string): "Meta" | "Google" {
  const k = (c || "").toLowerCase();
  if (k.includes("google") || k.includes("youtube") || k.includes("search")) return "Google";
  return "Meta";
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

function adType(p: Placement, mediaType: MediaKind): "Video" | "Image" | "Other" {
  const t = (p.ad_type ?? "").toLowerCase();
  if (t.includes("video")) return "Video";
  if (t.includes("image") || t.includes("photo")) return "Image";
  if (mediaType === "video") return "Video";
  if (mediaType === "image") return "Image";
  return "Other";
}

function PaidTextAdPlaceholder({ brand }: { brand: string }) {
  return (
    <div className="aspect-video w-full border-b-2 border-ink bg-gradient-to-br from-secondary to-paper flex flex-col items-center justify-center gap-2 px-4 text-center">
      <div className="w-12 h-12 rounded-full border-2 border-ink bg-paper flex items-center justify-center shadow-flat-sm">
        <Search size={22} strokeWidth={2.25} />
      </div>
      <div className="mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
        Google Search
      </div>
      <div className="mono text-[10px] px-2 py-0.5 border-2 border-ink rounded-[3px] bg-primary text-primary-foreground font-semibold">
        Paid Text Ad
      </div>
    </div>
  );
}

function MediaEmbed({
  creativeUrl,
  url,
  type,
  title,
  channel,
  brand,
}: {
  creativeUrl: string | null;
  url: string | null;
  type: MediaKind;
  title: string;
  channel: "Meta" | "Google";
  brand: string;
}) {
  // Google paid text ads or genuinely empty media → premium placeholder
  const directImg =
    typeof creativeUrl === "string" && /^https?:\/\//.test(creativeUrl) ? creativeUrl : null;

  if (channel === "Google" && !directImg) {
    return <PaidTextAdPlaceholder brand={brand} />;
  }

  // Prefer the raw creative_url as a direct <img> — Meta CDN URLs often lack
  // a recognizable image extension but are valid images.
  if (directImg) {
    return (
      <img
        src={directImg}
        alt={title}
        loading="lazy"
        className="aspect-video w-full object-cover border-b-2 border-ink bg-secondary"
        onError={(ev) => {
          (ev.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }

  if (url && type === "video") {
    return (
      <video
        controls
        preload="metadata"
        className="aspect-video w-full bg-black border-b-2 border-ink object-contain"
        src={url}
      />
    );
  }
  if (url && type === "image") {
    return (
      <img
        src={url}
        alt={title}
        loading="lazy"
        className="aspect-video w-full object-cover border-b-2 border-ink bg-secondary"
      />
    );
  }
  return <PaidTextAdPlaceholder brand={brand} />;
}

function AdvertisersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [country, setCountry] = useState<Country>("Australia");
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
        .select("id, domain, channel, ad_type, hook, days_running, creative_url, raw, created_at")
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

  const captureDomainInput = (value: string) => {
    setInput(value);
  };

  const captureCountry = (value: string) => {
    if (COUNTRY_OPTIONS.includes(value as Country)) {
      setCountry(value as Country);
    }
  };

  const addDomain = async () => {
    const domain = normalize(inputRef.current?.value ?? input);
    if (!domain || !/\.[a-z]{2,}$/.test(domain)) {
      toast.error("Enter a valid domain");
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

  const removeDomain = async (_id: number, domain: string) => {
    // Optimistic UI — clear from state first so the grid never references a deleted row.
    setRows((prev) => prev.filter((r) => r.domain !== domain));
    setPlacements((prev) => prev.filter((p) => p.domain !== domain));
    setActiveAdvertiser((cur) => (cur === domain ? "__all" : cur));
    try {
      // Cascade: purge child rows first so foreign references can't orphan the UI.
      await supabase.from("ad_placements").delete().eq("domain", domain);
      const { error } = await supabase.from("domain_scans").delete().eq("domain", domain);
      if (error) throw error;
      toast(`${domain} removed`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove domain");
    } finally {
      load();
    }
  };

  // Enriched placements w/ derived fields + AU market filter
  const enriched = useMemo(() => {
    const auOnly = country === "Australia";
    return placements
      .filter((p) => !auOnly || !isForeignToAU(p.domain))
      .map((p) => {
        const media = extractMediaUrl(p.creative_url, p.raw);
        return {
          ...p,
          brand: brandFromDomain(p.domain),
          channelNorm: normalizeChannel(p.channel ?? ""),
          media,
          adType: adType(p, media.type),
          days: p.days_running ?? 0,
        };
      });
  }, [placements, country]);

  const visibleRows = useMemo(
    () => (country === "Australia" ? rows.filter((r) => !isForeignToAU(r.domain)) : rows),
    [rows, country],
  );

  const advertisers = useMemo(() => {
    const set = new Map<string, { domain: string; brand: string; count: number }>();
    for (const e of enriched) {
      const prev = set.get(e.domain) ?? { domain: e.domain, brand: e.brand, count: 0 };
      prev.count += 1;
      set.set(e.domain, prev);
    }
    // also include tracked rows even if no placements
    for (const r of visibleRows) {
      if (!set.has(r.domain))
        set.set(r.domain, { domain: r.domain, brand: brandFromDomain(r.domain), count: 0 });
    }
    return Array.from(set.values()).sort((a, b) => b.count - a.count);
  }, [enriched, visibleRows]);

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
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    });
    return list;
  }, [enriched, activeAdvertiser, channelFilter, adTypeFilter, flightFilter, sortBy]);


  const channelCounts = useMemo(() => {
    const base = { Meta: 0, Google: 0 } as Record<string, number>;
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
            Add Competitor Domain
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => captureDomainInput(e.currentTarget.value)}
              onInput={(e) => captureDomainInput(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && addDomain()}
              placeholder="Enter domain"
              className="flex-1 h-10 text-sm font-mono"
              disabled={busy || rows.length >= MAX_BRANDS}
            />
            <Select
              value={country}
              onValueChange={captureCountry}
              disabled={busy || rows.length >= MAX_BRANDS}
            >
              <SelectTrigger className="w-full sm:w-56 h-10 text-sm">
                <SelectValue placeholder="Target country" />
              </SelectTrigger>
              <SelectContent className="z-50">
                {COUNTRY_OPTIONS.map((n) => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={addDomain}
              disabled={busy || rows.length >= MAX_BRANDS}
              className="h-10 gap-1.5"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add brand
            </Button>
          </div>
        </div>

        {/* Tracked brands strip */}
        {visibleRows.length > 0 && (
          <div className="card-flat overflow-hidden">
            <div className="px-4 py-3 border-b-2 border-ink bg-secondary mono text-[10px] uppercase font-bold">
              Tracked brands
            </div>
            <div className="flex flex-wrap gap-2 p-3">
              {visibleRows.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-2 border-2 border-ink rounded-[3px] bg-paper px-2 py-1"
                >
                  <span className="font-semibold text-sm">{brandFromDomain(r.domain)}</span>
                  <span className="mono text-[10px] text-muted-foreground">{r.domain}</span>
                  <ScanStatusPill status={r.status} />
                  
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
              {(["All", "Meta", "Google"] as const).map((c) => (
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
                {filtered.map((e) => {
                  return (
                  <Dialog key={e.id}>
                    <DialogTrigger asChild>
                      <article
                        className="card-flat overflow-hidden flex flex-col cursor-pointer text-left hover:shadow-md transition-shadow"
                        role="button"
                        tabIndex={0}
                      >
                        <MediaEmbed
                          creativeUrl={e.creative_url}
                          url={e.media.url}
                          type={e.media.type}
                          title={e.hook ?? e.brand}
                          channel={e.channelNorm}
                          brand={e.brand}
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
                              {new Date(e.created_at ?? 0).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </article>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          {e.brand}
                          <span className="mono text-[10px] px-1.5 py-0.5 border-2 border-ink rounded-[3px] bg-paper">
                            {e.channelNorm}
                          </span>
                          <span className="mono text-[10px] px-1.5 py-0.5 border border-ink/40 rounded-[3px]">
                            {e.adType}
                          </span>
                        </DialogTitle>
                        <DialogDescription className="mono text-[10px]">
                          {e.domain} · {e.days}d flight · {new Date(e.created_at ?? 0).toLocaleDateString()}
                        </DialogDescription>
                      </DialogHeader>
                      {(() => {
                        const isStaticImage =
                          typeof e.creative_url === "string" &&
                          /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(e.creative_url);
                        const isGoogle = e.channelNorm === "Google";
                        const allowEmbed = !isGoogle && isStaticImage;
                        const rawCopy = (() => {
                          const out: string[] = [];
                          const walk = (v: unknown, depth = 0) => {
                            if (!v || depth > 5) return;
                            if (typeof v === "string") {
                              const s = v.trim();
                              if (s && !/^https?:\/\//i.test(s) && s.length > 2) out.push(s);
                            } else if (Array.isArray(v)) {
                              v.forEach((x) => walk(x, depth + 1));
                            } else if (typeof v === "object") {
                              Object.values(v as Record<string, unknown>).forEach((x) =>
                                walk(x, depth + 1),
                              );
                            }
                          };
                          walk(e.raw);
                          return Array.from(new Set(out)).join("\n\n");
                        })();
                        return (
                          <div className="space-y-4">
                            {allowEmbed && e.media.url && e.media.type === "video" ? (
                              <video
                                controls
                                autoPlay
                                preload="metadata"
                                className="w-full max-h-[60vh] bg-black border-2 border-ink object-contain rounded-[3px]"
                                src={e.media.url}
                              />
                            ) : allowEmbed && e.media.url && e.media.type === "image" ? (
                              <img
                                src={e.media.url}
                                alt={e.hook ?? e.brand}
                                className="w-full max-h-[60vh] object-contain border-2 border-ink bg-secondary rounded-[3px]"
                              />
                            ) : (
                              <article className="card-flat p-5 space-y-4 bg-paper">
                                <h3 className="font-serif text-2xl font-bold leading-tight text-ink">
                                  {e.hook ?? e.brand}
                                </h3>
                                {(() => {
                                  const generic =
                                    !rawCopy ||
                                    /social media placement content optimized\.?/i.test(rawCopy) ||
                                    rawCopy.trim().length < 12;
                                  if (generic) {
                                    return (
                                      <div className="rounded-[3px] border-2 border-ink bg-secondary p-5 text-center">
                                        <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
                                          {e.brand}
                                        </div>
                                        <div className="font-serif text-xl font-bold text-ink">
                                          Active {e.channelNorm} Creative Campaign
                                        </div>
                                        <div className="mono text-[10px] text-muted-foreground mt-2">
                                          Live placement · {e.days}d flight
                                        </div>
                                      </div>
                                    );
                                  }
                                  return (
                                    <div>
                                      <h4 className="mono text-[10px] uppercase font-bold mb-2 text-muted-foreground">
                                        Ad copy
                                      </h4>
                                      <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink">
                                        {rawCopy}
                                      </p>
                                    </div>
                                  );
                                })()}
                                {isGoogle && (
                                  <div className="pt-2">
                                    <span className="mono text-[10px] uppercase font-bold inline-flex items-center gap-1.5 px-2.5 py-1 border-2 border-ink rounded-[3px] bg-secondary">
                                      <span className="inline-flex h-2 w-2 rounded-full bg-ink" />
                                      Google Search Ad
                                    </span>
                                  </div>
                                )}
                              </article>
                            )}
                            {allowEmbed && e.hook && (
                              <section>
                                <h4 className="mono text-[10px] uppercase font-bold mb-1">Ad copy</h4>
                                <p className="text-sm whitespace-pre-wrap">{e.hook}</p>
                              </section>
                            )}
                          </div>
                        );
                      })()}
                    </DialogContent>
                  </Dialog>
                  );
                })}
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
