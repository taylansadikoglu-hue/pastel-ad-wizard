import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ActiveClientWorkspaceBadge } from "@/components/adpalette/ActiveClientWorkspaceBadge";
import { useDemoAccount } from "@/contexts/DemoAccountContext";

/** Linen TopBar — 52px, logo + search + avatar. */
export function TopBar() {
  const [initials, setInitials] = useState("YOU");
  const { isDemo } = useDemoAccount();

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
      <a
        href="/app/dashboard"
        className="flex items-center select-none"
        title="The agency world calls us R-AD."
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.01em" }}>
          revenuad
        </span>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--accent-gold)" }}>.</span>
        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", marginLeft: 6 }}>
          signal
        </span>
      </a>

      <div className="flex-1" />

      {isDemo && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "#C9963A",
            background: "#FDF6E8",
            border: "1px solid #E8D5A0",
            borderRadius: 999,
            padding: "3px 10px",
            marginRight: 8,
          }}
        >
          Demo · read only
        </span>
      )}

      <ActiveClientWorkspaceBadge />

      <div
        className="hidden md:flex items-center gap-2 ml-3"
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
