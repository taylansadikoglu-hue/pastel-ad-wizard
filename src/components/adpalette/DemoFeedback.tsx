import { useEffect, useState } from "react";
import { MessageSquare, Star, X } from "lucide-react";

const API_BASE = (import.meta.env.VITE_ENGINE_URL as string) || "https://api.revenuad.com";

function isDemo(): boolean {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  if (url.searchParams.get("demo") === "true") return true;
  try {
    return localStorage.getItem("revenuead_demo_unlocked") === "1";
  } catch {
    return false;
  }
}

export function DemoFeedback() {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setVisible(isDemo());
  }, []);

  if (!visible) return null;

  const submit = async () => {
    setSending(true);
    try {
      await fetch(`${API_BASE}/api/demo/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          comment,
          page: window.location.pathname,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch {
      /* fire-and-forget */
    } finally {
      setSending(false);
      setDone(true);
      setTimeout(() => {
        setOpen(false);
        setDone(false);
        setRating(0);
        setComment("");
      }, 3000);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 10,
      }}
    >
      {open && (
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #EBE9E4",
            borderRadius: 10,
            padding: 16,
            width: 280,
            fontFamily: "Inter, sans-serif",
          }}
        >
          {done ? (
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#1C1C1A" }}>
                Thank you. Seriously.
              </div>
              <div style={{ fontSize: 13, color: "#9E9D94", marginTop: 4 }}>
                Your feedback shapes what we build next.
              </div>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1C1C1A" }}>
                  What do you think?
                </div>
                <button
                  onClick={() => setOpen(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#9E9D94" }}
                  aria-label="Close"
                >
                  <X size={14} />
                </button>
              </div>
              <textarea
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Be brutal. R-AD can take it."
                style={{
                  width: "100%",
                  resize: "none",
                  border: "1px solid #EBE9E4",
                  borderRadius: 6,
                  background: "#F7F6F3",
                  padding: 10,
                  fontSize: 13,
                  color: "#1C1C1A",
                  fontFamily: "Inter, sans-serif",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", gap: 4, marginTop: 10 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setRating(n)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}
                    aria-label={`Rate ${n}`}
                  >
                    <Star
                      size={18}
                      color={n <= rating ? "#C9963A" : "#EBE9E4"}
                      fill={n <= rating ? "#C9963A" : "none"}
                      strokeWidth={1.5}
                    />
                  </button>
                ))}
              </div>
              <button
                onClick={submit}
                disabled={sending || (!comment && rating === 0)}
                style={{
                  marginTop: 12,
                  width: "100%",
                  background: "#1C1C1A",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: 7,
                  padding: "9px 14px",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: sending ? "default" : "pointer",
                  opacity: sending || (!comment && rating === 0) ? 0.5 : 1,
                }}
              >
                {sending ? "Sending…" : "Send feedback"}
              </button>
            </>
          )}
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: "#1C1C1A",
          color: "#FFFFFF",
          border: "none",
          borderRadius: 20,
          padding: "8px 14px",
          fontSize: 12,
          fontWeight: 500,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontFamily: "Inter, sans-serif",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        <MessageSquare size={14} strokeWidth={1.5} />
        Feedback
      </button>
    </div>
  );
}
