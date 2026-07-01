import { useState, type CSSProperties, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { CATEGORY_OPTIONS, normalizeClientDomain } from "@/lib/clientWorkspace";
import { ENGINE_URL } from "@/lib/engine";
import { displayBrand } from "@/utils/brandDisplay";

type SearchResponse = {
  status?: string;
  job_id?: string | number;
  stage_detail?: string;
  error?: string;
};

const fieldStyle: CSSProperties = {
  width: "100%",
  background: "#FFFFFF",
  border: "1px solid #EBE9E4",
  borderRadius: 8,
  height: 40,
  padding: "0 12px",
  fontSize: 14,
  color: "#1C1C1A",
  outline: "none",
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "#6B6B62",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 6,
};

/** Cold-start client search — queues engine backfill, then routes to building progress. */
export function ClientSearch() {
  const navigate = useNavigate();
  const [brand, setBrand] = useState("");
  const [domain, setDomain] = useState("");
  const [category, setCategory] = useState<string>(CATEGORY_OPTIONS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const normalized = normalizeClientDomain(domain.trim());
    if (!normalized || !normalized.includes(".")) {
      setError("Enter a valid client domain (e.g. commbank.com.au)");
      return;
    }
    if (!category.trim()) {
      setError("Category is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const resolvedBrand = brand.trim() || displayBrand(normalized);
      const res = await fetch(`${ENGINE_URL}/api/clients/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: normalized,
          domain: normalized,
          brand: resolvedBrand,
          category,
        }),
      });
      const data = (await res.json()) as SearchResponse;

      if (data.status === "category_required") {
        setError("Category is required");
        return;
      }

      if (!res.ok || data.job_id == null) {
        setError(data.stage_detail ?? data.error ?? "Search failed — try again");
        return;
      }

      navigate({
        to: "/app/building/$jobId",
        params: { jobId: String(data.job_id) },
      });
    } catch {
      setError("Could not reach the search API");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: "#FFFFFF",
        border: "1px solid #EBE9E4",
        borderRadius: 10,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Search size={16} style={{ color: "#C9963A" }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1A" }}>Index a new client</div>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: "#6B6B62", lineHeight: 1.45 }}>
        Search by brand, domain, and category. We pull cross-channel ads and open the war room when ready.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
        }}
      >
        <label style={{ display: "block" }}>
          <span style={labelStyle}>Brand</span>
          <input
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="CommBank"
            style={fieldStyle}
          />
        </label>
        <label style={{ display: "block" }}>
          <span style={labelStyle}>Domain</span>
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="commbank.com.au"
            required
            style={fieldStyle}
          />
        </label>
        <label style={{ display: "block" }}>
          <span style={labelStyle}>Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ ...fieldStyle, cursor: "pointer" }}
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <div style={{ fontSize: 13, color: "#C0392B" }} role="alert">
          {error}
        </div>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={loading}
          style={{
            background: loading ? "#EBE9E4" : "#1C1C1A",
            color: "#FFFFFF",
            border: "none",
            borderRadius: 8,
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 500,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Starting index…" : "Search & index"}
        </button>
      </div>
    </form>
  );
}
