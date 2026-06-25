import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/** Linen TopBar — 52px, logo + search + (demo pill) + avatar. */
export function TopBar({ demo = false }: { demo?: boolean }) {
  const [initials, setInitials] = useState("YOU");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!u || !active) return;
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      const display =
        (meta.full_name as string) ||
        (meta.name as string) ||
        (u.email ?? "").split("@")[0] ||
        "You";
      const parts = display.split(/[\s._-]+/).filter(Boolean);
      const ini = (parts[0]?.[0] ?? "Y") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "");
      setInitials(ini.toUpperCase().slice(0, 2));
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <header className="topbar-shell">
      <a href="/app/dashboard" className="flex items-center select-none">
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.01em" }}>
          revenuad
        </span>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--accent-gold)" }}>.</span>
      </a>

      {demo && (
        <span
          className="pill pill-active"
          style={{ fontSize: 11, fontWeight: 500, padding: "3px 10px" }}
        >
          Demo account
        </span>
      )}

      <div className="flex-1" />

      <div
        className="hidden md:flex items-center gap-2"
        style={{
          background: "var(--canvas)",
          border: "1px solid var(--hairline)",
          borderRadius: 6,
          height: 32,
          width: 280,
          padding: "0 10px",
        }}
      >
        <Search size={14} style={{ color: "var(--text-placeholder)", strokeWidth: 1.5 }} />
        <input
          type="text"
          placeholder="Search brands, categories…"
          className="bg-transparent outline-none flex-1"
          style={{ fontSize: 13, color: "var(--ink)" }}
        />
      </div>

      <div
        className="grid place-items-center"
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          background: "var(--ink)",
          color: "#FFF",
          fontSize: 11,
          fontWeight: 600,
        }}
        aria-label="Account"
      >
        {initials}
      </div>
    </header>
  );
}
