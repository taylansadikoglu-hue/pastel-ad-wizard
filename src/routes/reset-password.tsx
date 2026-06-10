import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ThemeProvider } from "@/components/adpalette/theme";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set new password — RevenueAd" },
      { name: "description", content: "Set a new password for your RevenueAd workspace." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Supabase places the recovery token in the URL hash and emits a PASSWORD_RECOVERY event.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    // Fallback: if there's already a session, allow update
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    // If the URL contains an error from the email link, surface it
    if (typeof window !== "undefined" && window.location.hash.includes("error")) {
      const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      setError(params.get("error_description") ?? "This reset link is invalid or has expired.");
    }
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. Redirecting…");
      setTimeout(() => navigate({ to: "/app", replace: true }), 600);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-canvas text-ink grid place-items-center px-6 py-10">
        <div className="w-full max-w-md card-flat p-6 space-y-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Set a new password</h1>
            <p className="text-sm text-muted-foreground mt-1">Choose a strong password — at least 8 characters.</p>
          </div>

          {error && (
            <div className="card-flat p-4 text-sm bg-secondary/40">
              <div className="font-semibold">Link expired</div>
              <p className="text-muted-foreground mt-1">{error}</p>
              <Link to="/forgot-password" className="btn-flat mt-3 inline-flex">Request a new link</Link>
            </div>
          )}

          {!error && (
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="mono text-[11px] font-bold">NEW PASSWORD</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-flat mt-1"
                  placeholder="••••••••"
                  disabled={!ready}
                />
              </div>
              <div>
                <label className="mono text-[11px] font-bold">CONFIRM PASSWORD</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="input-flat mt-1"
                  placeholder="••••••••"
                  disabled={!ready}
                />
              </div>
              <button type="submit" disabled={loading || !ready} className="btn-flat btn-primary w-full justify-center">
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <>Update password <ArrowRight size={14} /></>
                )}
              </button>
              {!ready && (
                <p className="mono text-[11px] text-muted-foreground text-center">
                  Waiting for recovery session… open this page from your reset email.
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </ThemeProvider>
  );
}
