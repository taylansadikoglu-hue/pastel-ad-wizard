import { Link } from "@tanstack/react-router";
import { ArrowRight, Lock } from "lucide-react";
import {
  CATEGORY_PACK_PRICING,
  healthTone,
  type CategoryIntel,
  type LockedCategoryPreview,
} from "@/lib/categoryCatalog";

function brandInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function BrandChip({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <div
      title={name}
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        background: "#FDF6E8",
        border: "1px solid #E8D5A0",
        color: "#8A6A1F",
        fontSize: size < 30 ? 10 : 11,
        fontWeight: 700,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      {brandInitials(name)}
    </div>
  );
}

export function UnlockedCategoryCard({ category }: { category: CategoryIntel }) {
  const health = healthTone(category.healthScore);

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #EBE9E4",
        borderRadius: 12,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        minHeight: 280,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9E9D94" }}>
            ✅ Included
          </div>
          <h3 style={{ margin: "6px 0 0", fontSize: 18, fontWeight: 600, color: "#1C1C1A", lineHeight: 1.2 }}>
            {category.name}
          </h3>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6B6B62" }}>
            {category.brandCount} brands tracked
          </p>
        </div>
        <div
          style={{
            textAlign: "center",
            background: health.bg,
            border: `1px solid ${health.color}22`,
            borderRadius: 10,
            padding: "8px 10px",
            minWidth: 72,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 700, color: health.color, lineHeight: 1 }}>{category.healthScore}</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: health.color, marginTop: 4 }}>Health</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <BrandChip name={category.leading} />
        <BrandChip name={category.rising} />
        <BrandChip name={category.threat} />
      </div>

      <dl style={{ margin: 0, display: "grid", gap: 8, fontSize: 13 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <dt style={{ color: "#9E9D94" }}>Leading</dt>
          <dd style={{ margin: 0, fontWeight: 600, color: "#1C1C1A" }}>{category.leading}</dd>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <dt style={{ color: "#9E9D94" }}>Rising</dt>
          <dd style={{ margin: 0, fontWeight: 600, color: "#1C1C1A" }}>{category.rising}</dd>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <dt style={{ color: "#9E9D94" }}>Threat</dt>
          <dd style={{ margin: 0, fontWeight: 600, color: "#1C1C1A" }}>{category.threat}</dd>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <dt style={{ color: "#9E9D94" }}>Opportunity</dt>
          <dd style={{ margin: 0, fontWeight: 600, color: "#C9963A", textAlign: "right" }}>{category.topOpportunity}</dd>
        </div>
      </dl>

      <Link
        to="/app/category/$slug"
        params={{ slug: category.slug }}
        style={{
          marginTop: "auto",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          background: "#1C1C1A",
          color: "#FFFFFF",
          borderRadius: 8,
          padding: "10px 16px",
          fontSize: 13,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        Open <ArrowRight size={14} />
      </Link>
    </div>
  );
}

function SkeletonBar({ width }: { width: string }) {
  return (
    <div
      style={{
        height: 10,
        width,
        borderRadius: 4,
        background: "linear-gradient(90deg, #E8E6E1 0%, #F3F1EC 50%, #E8E6E1 100%)",
      }}
    />
  );
}

export function LockedCategoryCard({ category }: { category: LockedCategoryPreview }) {
  return (
    <div
      style={{
        position: "relative",
        background: "#FFFFFF",
        border: "1px solid #EBE9E4",
        borderRadius: 12,
        padding: 20,
        overflow: "hidden",
        minHeight: 280,
      }}
    >
      <div style={{ filter: "blur(5px)", opacity: 0.55, pointerEvents: "none", userSelect: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Lock size={14} color="#9E9D94" />
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#1C1C1A" }}>{category.name}</h3>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {category.logoSeeds.map((seed) => (
            <BrandChip key={seed} name={seed} size={28} />
          ))}
        </div>

        <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
          <SkeletonBar width="92%" />
          <SkeletonBar width="78%" />
          <SkeletonBar width="86%" />
        </div>

        <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#9E9D94" }}>Top opportunity</span>
            <span style={{ fontWeight: 600, color: "#6B6B62" }}>████████</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#9E9D94" }}>Threat score</span>
            <span style={{ fontWeight: 600, color: "#6B6B62" }}>████████</span>
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          background: "linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.82) 58%, rgba(255,255,255,0.94) 100%)",
        }}
      >
        <div style={{ textAlign: "center", padding: "0 20px" }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#1C1C1A", marginBottom: 6 }}>
            {category.name} 🔒
          </div>
          <div style={{ fontSize: 13, color: "#6B6B62", marginBottom: 14 }}>Unlock to view</div>
          <a
            href="mailto:hello@revenuad.com?subject=Unlock%20Category%20Pack"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              color: "#C9963A",
              textDecoration: "none",
              border: "1px solid #E8D5A0",
              borderRadius: 999,
              padding: "8px 14px",
              background: "#FDF6E8",
            }}
          >
            Unlock Category Pack
          </a>
        </div>
      </div>
    </div>
  );
}

export function CategoryPackPricing() {
  return (
    <section
      style={{
        marginTop: 36,
        background: "#F7F6F3",
        border: "1px solid #EBE9E4",
        borderRadius: 14,
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 720 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#1C1C1A" }}>Unlock Category Pack</h2>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: "#6B6B62", lineHeight: 1.6 }}>
          Expand beyond Banking, Insurance, Telco, and Retail with additional vertical intelligence.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 14,
          marginTop: 20,
        }}
      >
        <PricingTile
          title={CATEGORY_PACK_PRICING.fourPack.label}
          price={CATEGORY_PACK_PRICING.fourPack.price}
          description="Add four locked verticals to your workspace."
        />
        <PricingTile
          title={CATEGORY_PACK_PRICING.allCategories.label}
          price={CATEGORY_PACK_PRICING.allCategories.price}
          description="Full category coverage across every vertical."
          badge={CATEGORY_PACK_PRICING.allCategories.badge}
          featured
        />
      </div>
    </section>
  );
}

function PricingTile({
  title,
  price,
  description,
  badge,
  featured = false,
}: {
  title: string;
  price: number;
  description: string;
  badge?: string;
  featured?: boolean;
}) {
  return (
    <div
      style={{
        position: "relative",
        background: "#FFFFFF",
        border: featured ? "2px solid #1C1C1A" : "1px solid #EBE9E4",
        borderRadius: 12,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {badge && (
        <span
          style={{
            position: "absolute",
            top: -11,
            left: 16,
            background: "#1C1C1A",
            color: "#FFFFFF",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            padding: "4px 10px",
            borderRadius: 4,
          }}
        >
          {badge}
        </span>
      )}
      <div style={{ fontSize: 15, fontWeight: 600, color: "#1C1C1A" }}>{title}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontSize: 32, fontWeight: 700, color: "#1C1C1A", letterSpacing: "-0.03em" }}>${price}</span>
        <span style={{ fontSize: 13, color: "#9E9D94" }}>/month</span>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: "#6B6B62", lineHeight: 1.5, flex: 1 }}>{description}</p>
      <a
        href={`mailto:hello@revenuad.com?subject=${encodeURIComponent(`Unlock: ${title}`)}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          marginTop: 4,
          background: featured ? "#1C1C1A" : "#FFFFFF",
          color: featured ? "#FFFFFF" : "#1C1C1A",
          border: featured ? "none" : "1px solid #EBE9E4",
          borderRadius: 8,
          padding: "10px 14px",
          fontSize: 13,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        Unlock Category Pack <ArrowRight size={14} />
      </a>
    </div>
  );
}
