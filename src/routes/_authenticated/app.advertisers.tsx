import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Search as SearchIcon,
  Youtube,
  Image as ImageIcon,
  Facebook,
  Music2,
  Linkedin,
} from "lucide-react";
import { WorkspaceShell } from "@/components/adpalette/WorkspaceShell";
import { SpendIndex } from "@/components/adpalette/SpendIndex";
import { displayBrand } from "@/utils/brandDisplay";
import { supabase } from "@/integrations/supabase/client";

const API_BASE = "https://api.revenuad.com";

// ─── Types ────────────────────────────────────────────────────────────────────

type Advertiser = {
  name?: string;
  brand?: string;
  domain?: string;
  category?: string;
  industry?: string;
  total_ads?: number;
  ad_count?: number;
  sighting_count?: number;
  total_sightings?: number;
  spend_signal?: number;
  channels?: string[] | Record<string, number>;
  themes?: string[];
  top_themes?: Array<string | { theme: string }>;
};

type FeaturedBrand = Advertiser & {
  sighting_count?: number;
};

// ─── Channel config ───────────────────────────────────────────────────────────

const CHANNELS: { key: string; label: string; aliases: string[]; Icon: typeof SearchIcon }[] = [
  { key: "youtube", label: "YouTube", aliases: ["youtube", "video"], Icon: Youtube },
  { key: "search", label: "Search", aliases: ["search", "google search", "google_search", "google"], Icon: SearchIcon },
  { key: "display", label: "Display", aliases: ["display", "google display", "google_display", "image"], Icon: ImageIcon },
  { key: "meta", label: "Meta", aliases: ["meta", "facebook", "instagram"], Icon: Facebook },
  { key: "tiktok", label: "TikTok", aliases: ["tiktok"], Icon: Music2 },
  { key: "linkedin", label: "LinkedIn", aliases: ["linkedin"], Icon: Linkedin },
];

const CATEGORIES = ["All", "Banking", "Auto", "Telco", "Retail", "Health", "Insurance"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rootSlug(d: string): string {
  return d.toLowerCase().replace(/^www\./, "").split(".")[0] ?? d;
}

function initialsOf(name: string): string {
  const s = name.trim();
  if (!s) return "—";
  const parts = s.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1][0] ?? "")).toUpperCase();
}

function formatSightings(n: number | undefined | null): string {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return "0 impressions";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M impressions`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)}K impressions`;
  return `${v} impressions`;
}

function getChannels(a: Advertiser): string[] {
  if (Array.isArray(a.channels)) return a.channels.map((c) => String(c).toLowerCase());
  if (a.channels && typeof a.channels === "object") {
    return Object.entries(a.channels)
      .filter(([, v]) => Number(v) > 0)
      .map(([k]) => k.toLowerCase());
  }
  return [];
}

function isChannelActive(channelAliases: string[], present: string[]): boolean {
  return channelAliases.some((a) => present.includes(a));
}

function getThemes(a: Advertiser): string[] {
  if (Array.isArray(a.themes)) return a.themes.filter(Boolean);
  if (Array.isArray(a.top_themes)) {
    return a.top_themes
      .map((t) => (typeof t === "string" ? t : t?.theme))
      .filter((t): t is string => Boolean(t));
  }
  return [];
}

function matchesCategory(a: Advertiser, cat: string): boolean {
  if (cat === "All") return true;
  const c = (a.category ?? a.industry ?? "").toLowerCase();
  const q = cat.toLowerCase();
  if (q === "auto") return /auto|motor|car/.test(c);
  if (q === "telco") return /telco|telecom|mobile/.test(c);
  if (q === "health") return /health|medical/.test(c);
  if (q === "insurance") return /insurance/.test(c);
  if (q === "banking") return /bank|financ/.test(c);
  if (q === "retail") return /retail|shop|grocer/.test(c);
  return c.includes(q);
}

function brandDomain(a: Advertiser): string {
  const d = (a.domain ?? "").trim();
  if (d) return d.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const n = (a.name ?? a.brand ?? "").trim();
  return n.toLowerCase().replace(/\s+/g, "");
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function AdvertisersPage() {
  const search = (useSearch({ strict: false }) as { demo?: string | boolean }) ?? {};
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [list, setList] = useState<Advertiser[]>([]);
  const [featured, setFeatured] = useState<FeaturedBrand[]>([]);
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
  }, []);

  const demoMode = useMemo(() => {
    const q = String(search.demo ?? "").toLowerCase();
    if (q === "true" || q === "1") return true;
    return userEmail === "demo@revenuad.com";
  }, [search.demo, userEmail]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`${API_BASE}/api/advertisers?limit=50`);
        const j = r.ok ? await r.json() : null;
        const arr: Advertiser[] = Array.isArray(j) ? j : (j?.advertisers ?? []);
        if (alive) setList(arr);
      } catch {
        if (alive) setList([]);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!demoMode) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/demo/featured-brands`);
        const j = r.ok ? await r.json() : null;
        const arr: FeaturedBrand[] = Array.isArray(j) ? j : (j?.brands ?? j?.advertisers ?? []);
        if (alive) setFeatured(arr);
      } catch {
        if (alive) setFeatured([]);
      }
    })();
    return () => { alive = false; };
  }, [demoMode]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((a) => {
      if (!matchesCategory(a, activeCat)) return false;
      if (!q) return true;
      const name = (a.name ?? a.brand ?? "").toLowerCase();
      const d = brandDomain(a).toLowerCase();
      return name.includes(q) || d.includes(q);
    });
  }, [list, query, activeCat]);

  return (
    <WorkspaceShell title="Ad Library" subtitle="Tracked competitor creatives and channel mix">
      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1200 }}>
        {/* Search bar */}
        <div style={{ position: "relative" }}>
          <SearchIcon size={16} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "#9E9D94" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any brand or domain..."
            style={{
              width: "100%",
              background: "#FFFFFF",
              border: "1px solid #EBE9E4",
              borderRadius: 8,
              height: 44,
              padding: "0 16px 0 42px",
              fontSize: 14,
              color: "#1C1C1A",
              outline: "none",
            }}
          />
        </div>

        {/* Category pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {CATEGORIES.map((c) => {
            const active = activeCat === c;
            return (
              <button
                key={c}
                onClick={() => setActiveCat(c)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 500,
                  border: "none",
                  cursor: "pointer",
                  background: active ? "#1C1C1A" : "transparent",
                  color: active ? "#FFFFFF" : "#6B6B62",
                }}
              >
                {c}
              </button>
            );
          })}
        </div>

        {/* Featured (demo only) */}
        {demoMode && featured.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "#C9963A",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 12,
              }}
            >
              Featured brands
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
              {featured.map((b, i) => (
                <FeaturedCard key={b.domain ?? b.name ?? i} brand={b} />
              ))}
            </div>
          </div>
        )}

        {/* Main grid */}
        <div>
          {loading ? (
            <div style={emptyState}>Reading signal…</div>
          ) : filtered.length === 0 ? (
            <div style={emptyState}>
              {query ? `No brands match "${query}"` : "No advertisers yet"}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {filtered.map((a, i) => (
                <BrandCard key={brandDomain(a) || i} brand={a} />
              ))}
            </div>
          )}
        </div>
      </div>
    </WorkspaceShell>
  );
}

// ─── Cards ────────────────────────────────────────────────────────────────────

function BrandCard({ brand }: { brand: Advertiser }) {
  const name = displayBrand(brand.name ?? brand.brand ?? brand.domain ?? "");
  const domain = brandDomain(brand);
  const cat = brand.category ?? brand.industry ?? "—";
  const ads = Number(brand.total_ads ?? brand.ad_count ?? 0);
  const present = getChannels(brand);
  const activeCount = CHANNELS.filter((c) => isChannelActive(c.aliases, present)).length;
  const themes = getThemes(brand).slice(0, 3);
  const spend = Number(brand.spend_signal ?? 0);

  return (
    <Link
      to="/app/advertiser/$domain"
      params={{ domain: domain || rootSlug(name) }}
      style={{ textDecoration: "none" }}
    >
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #EBE9E4",
          borderRadius: 10,
          padding: 20,
          cursor: "pointer",
          transition: "border-color 120ms ease",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          height: "100%",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#C9963A")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#EBE9E4")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar name={name} size={32} />
          <div style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, color: "#1C1C1A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {name}
          </div>
          <SpendIndex level={spend > 0 ? spend : undefined} showCaption={false} />
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 11, color: "#9E9D94" }}>
          <span
            style={{
              padding: "2px 8px",
              background: "#F0EDE8",
              borderRadius: 3,
              color: "#6B6B62",
              fontWeight: 500,
              textTransform: "capitalize",
            }}
          >
            {cat}
          </span>
          <span>· {ads} ads</span>
          <span>· {activeCount} channels</span>
        </div>

        {themes.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {themes.map((t, i) => (
              <span
                key={i}
                style={{
                  padding: "3px 8px",
                  borderRadius: 3,
                  background: "#F0EDE8",
                  fontSize: 11,
                  color: "#6B6B62",
                }}
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <ChannelIconRow present={present} />

        <div style={{ fontSize: 11, color: "#C9963A", marginTop: 2 }}>
          Open war room →
        </div>
      </div>
    </Link>
  );
}

function FeaturedCard({ brand }: { brand: FeaturedBrand }) {
  const name = displayBrand(brand.name ?? brand.brand ?? brand.domain ?? "");
  const domain = brandDomain(brand);
  const cat = brand.category ?? brand.industry ?? "—";
  const present = getChannels(brand);
  const activeCount = CHANNELS.filter((c) => isChannelActive(c.aliases, present)).length;
  const themes = getThemes(brand).slice(0, 5);
  const spend = Number(brand.spend_signal ?? 0);
  const impressions = Number(brand.sighting_count ?? brand.total_sightings ?? 0);

  return (
    <Link
      to="/app/advertiser/$domain"
      params={{ domain: domain || rootSlug(name) }}
      style={{ textDecoration: "none" }}
    >
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #EBE9E4",
          borderRadius: 10,
          padding: 24,
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          height: "100%",
          transition: "border-color 120ms ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#C9963A")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#EBE9E4")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar name={name} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#1C1C1A" }}>{name}</div>
            <div style={{ fontSize: 12, color: "#9E9D94", marginTop: 2, textTransform: "capitalize" }}>
              {cat} · {activeCount} channels
            </div>
          </div>
          <SpendIndex level={spend > 0 ? spend : undefined} showCaption={false} />
        </div>

        <div style={{ fontSize: 13, color: "#6B6B62", fontWeight: 500 }}>
          {formatSightings(impressions)}
        </div>

        {themes.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {themes.map((t, i) => (
              <span
                key={i}
                style={{
                  padding: "4px 10px",
                  borderRadius: 4,
                  background: "#F0EDE8",
                  fontSize: 12,
                  color: "#6B6B62",
                }}
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <ChannelIconRow present={present} />

        <div style={{ fontSize: 12, color: "#C9963A", fontWeight: 500 }}>
          Open war room →
        </div>
      </div>
    </Link>
  );
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        background: "#FDF6E8",
        color: "#C9963A",
        fontSize: Math.round(size * 0.38),
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {initialsOf(name)}
    </div>
  );
}

function ChannelIconRow({ present }: { present: string[] }) {
  return (
    <div style={{ display: "flex", gap: 10, marginTop: "auto" }}>
      {CHANNELS.map((c) => {
        const active = isChannelActive(c.aliases, present);
        return (
          <c.Icon
            key={c.key}
            size={16}
            style={{ color: active ? "#C9963A" : "#EBE9E4" }}
          />
        );
      })}
    </div>
  );
}

const emptyState: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #EBE9E4",
  borderRadius: 10,
  padding: 48,
  textAlign: "center",
  color: "#6B6B62",
  fontSize: 13,
};

export const Route = createFileRoute("/_authenticated/app/advertisers")({
  component: AdvertisersPage,
});
