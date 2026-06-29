import { useCallback, useEffect, useState } from "react";
import { Loader2, KeyRound, Radar } from "lucide-react";
import { toast } from "sonner";
import { getIntegrations, saveIntegrations } from "@/lib/integrations.functions";
import { useDemoAccount } from "@/contexts/DemoAccountContext";

const LINEN_CARD: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #EBE9E4",
  borderRadius: 12,
  padding: 20,
};

export function IntegrationsSettings() {
  const { canExport } = useDemoAccount();
  const readOnly = !canExport;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [similarwebKey, setSimilarwebKey] = useState("");
  const [hasSavedKey, setHasSavedKey] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const row = await getIntegrations();
      setHasSavedKey(Boolean(row.similarweb_rapidapi_key));
      setSimilarwebKey("");
    } catch {
      toast.error("Could not load integrations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (readOnly) return;
    setSaving(true);
    try {
      await saveIntegrations({
        data: {
          similarweb_rapidapi_key: similarwebKey.trim() || null,
        },
      });
      toast.success("Integrations saved.");
      setHasSavedKey(Boolean(similarwebKey.trim()) || hasSavedKey);
      setSimilarwebKey("");
      await load();
    } catch {
      toast.error("Could not save integrations.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ fontSize: 13, color: "#9E9D94", display: "flex", alignItems: "center", gap: 8 }}>
        <Loader2 size={16} className="animate-spin" /> Loading integrations…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
      <div style={LINEN_CARD}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "#FDF6E8",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <Radar size={20} color="#C9963A" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1C1C1A" }}>Similar Web Data (RapidAPI)</div>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6B6B62", lineHeight: 1.5 }}>
              Powers visit trends, category position, search mix, and audience-overlap rivals on advertiser pages.
              Leave blank to use the workspace system key (<code style={{ fontSize: 12 }}>SIMILARWEB_RAPIDAPI_KEY</code>).
            </p>
          </div>
        </div>

        <label style={{ display: "block", marginTop: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#9E9D94", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            RapidAPI key
          </span>
          <div style={{ position: "relative", marginTop: 6 }}>
            <KeyRound size={16} style={{ position: "absolute", left: 12, top: 12, color: "#9E9D94" }} />
            <input
              type="password"
              value={similarwebKey}
              onChange={(e) => setSimilarwebKey(e.target.value)}
              disabled={readOnly}
              placeholder={hasSavedKey ? "Key saved — paste to replace" : "x-rapidapi-key value"}
              autoComplete="off"
              style={{
                width: "100%",
                padding: "10px 12px 10px 36px",
                fontSize: 14,
                border: "1px solid #EBE9E4",
                borderRadius: 8,
                background: readOnly ? "#F7F6F3" : "#FFFFFF",
              }}
            />
          </div>
        </label>

        {hasSavedKey && !similarwebKey && (
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "#2D7D46" }}>A Similar Web key is on file for your account.</p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={readOnly || saving || !similarwebKey.trim()}
          style={{
            marginTop: 14,
            fontSize: 13,
            fontWeight: 600,
            padding: "10px 16px",
            borderRadius: 8,
            border: "none",
            background: readOnly || !similarwebKey.trim() ? "#EBE9E4" : "#1C1C1A",
            color: readOnly || !similarwebKey.trim() ? "#9E9D94" : "#FFFFFF",
            cursor: readOnly || saving || !similarwebKey.trim() ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving…" : "Save key"}
        </button>
      </div>

      <p style={{ fontSize: 12, color: "#9E9D94", lineHeight: 1.5 }}>
        Host: <code>similar-web-data.p.rapidapi.com</code> · Set <code>SIMILARWEB_RAPIDAPI_HOST</code> on the server
        before launch if you use a different RapidAPI product.
      </p>
    </div>
  );
}
