import { useEffect, useRef, useState } from "react";
import { MessageSquare, X, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`;
  return h;
}

type Msg = { role: "user" | "assistant"; content: string };

const INTRO: Msg = {
  role: "assistant",
  content:
    "I'm BARBS — your market intelligence partner.\n\nI've already read this morning's activity across your tracked brands.\n\nAsk me about the threats, the opportunities, or what to do next.",
};

export function BarbsChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([INTRO]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      try {
        localStorage.setItem("barbs_opened", "1");
      } catch {
        // ignore
      }
    }
  }, [open]);

  // Auto-open once ever — 3s after first mount, only if user has never opened it
  useEffect(() => {
    let alreadyOpened = false;
    try {
      alreadyOpened = localStorage.getItem("barbs_opened") === "1";
    } catch {
      // ignore
    }
    if (alreadyOpened) return;
    const t = setTimeout(() => setOpen(true), 3000);
    return () => clearTimeout(t);
  }, []);

  // External trigger: window.dispatchEvent(new CustomEvent("barbs:ask", { detail: "query" }))
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail !== "string" || !detail.trim()) return;
      setOpen(true);
      setInput(detail);
      // auto-send shortly after open so input ref is mounted
      setTimeout(() => {
        setInput("");
        setMessages((prev) => {
          const next: Msg[] = [...prev, { role: "user", content: detail }];
          (async () => {
            setLoading(true);
            try {
              const res = await fetch("/api/barbs", {
                method: "POST",
                headers: await authHeaders(),
                body: JSON.stringify({ messages: next }),
              });
              if (!res.ok) throw new Error(await res.text());
              const { reply } = (await res.json()) as { reply: string };
              setMessages((m) => [...m, { role: "assistant", content: reply || "(no response)" }]);
            } catch (err) {
              setMessages((m) => [
                ...m,
                { role: "assistant", content: `Signal lost. Retry in a moment. (${String(err).slice(0, 120)})` },
              ]);
            } finally {
              setLoading(false);
            }
          })();
          return next;
        });
      }, 50);
    };
    window.addEventListener("barbs:ask", handler as EventListener);
    return () => window.removeEventListener("barbs:ask", handler as EventListener);
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/barbs", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { reply } = (await res.json()) as { reply: string };
      setMessages((m) => [...m, { role: "assistant", content: reply || "(no response)" }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Signal lost. Retry in a moment. (${String(e).slice(0, 120)})` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 bg-ink text-paper border-2 border-ink rounded-[6px] shadow-flat-sm hover:shadow-flat font-semibold transition-all"
          aria-label="Open Barbs AI Assistant"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-pastel-sage opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-pastel-sage" />
          </span>
          <MessageSquare size={16} />
          <span className="text-sm">Barbs | Online AI Assistant</span>
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[min(95vw,400px)] h-[min(80vh,560px)] flex flex-col bg-paper border-2 border-ink rounded-[8px] shadow-flat overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-ink text-paper border-b-2 border-ink">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 grid place-items-center bg-primary text-ink border-2 border-paper rounded-[4px] font-bold text-xs">B</div>
              <div>
                <div className="font-bold text-sm leading-tight">Barbs</div>
                <div className="mono text-[10px] opacity-80 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-pastel-sage" /> Online · AI Concierge
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="hover:bg-paper/10 p-1 rounded" aria-label="Close">
              <X size={16} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-canvas">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 border-2 border-ink rounded-[6px] text-sm whitespace-pre-wrap ${
                    m.role === "user" ? "bg-primary text-ink" : "bg-paper text-ink"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="px-3 py-2 border-2 border-ink rounded-[6px] bg-paper text-ink text-sm flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> Crunching signal…
                </div>
              </div>
            )}
          </div>

          <div className="border-t-2 border-ink p-2 bg-paper flex items-center gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask Barbs about a competitor or niche…"
              className="flex-1 px-3 py-2 border-2 border-ink rounded-[4px] bg-canvas text-sm focus:outline-none focus:ring-0"
              disabled={loading}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="p-2 border-2 border-ink rounded-[4px] bg-primary text-ink disabled:opacity-50"
              aria-label="Send"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
