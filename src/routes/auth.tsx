import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import { ThemeProvider } from "@/components/adpalette/theme";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — RevenueAd" },
      { name: "description", content: "Sign in to your RevenueAd workspace to track competitor ad spend across every channel." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/app", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") navigate({ to: "/app", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/app` },
        });
        if (error) throw error;
        toast.success("Account created. Check your inbox to confirm if required.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setLoading(false);
    }
  };


  return (
    <ThemeProvider>
      <div className="min-h-screen bg-canvas text-ink grid place-items-center px-6 py-10">
        <div className="w-full max-w-md card-flat p-6 space-y-5">
          <Link to="/" className="flex items-center gap-2">
            <div className="px-1.5 h-7 border-2 border-ink rounded-[4px] bg-primary grid place-items-center">
              <span className="mono text-[10px] font-bold">R-AD</span>
            </div>
            <span className="font-bold tracking-tight">RevenueAd</span>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{mode === "signin" ? "Sign in to your workspace" : "Create your workspace"}</h1>
            <p className="text-sm text-muted-foreground mt-1">Track every competitor ad placement, live.</p>
          </div>


          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="mono text-[11px] font-bold">EMAIL</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input-flat mt-1" placeholder="you@agency.com" />
            </div>
            <div>
              <label className="mono text-[11px] font-bold">PASSWORD</label>
              <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="input-flat mt-1" placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading} className="btn-flat btn-primary w-full justify-center">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <>{mode === "signin" ? "Sign in" : "Create workspace"} <ArrowRight size={14} /></>}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
            className="text-xs underline underline-offset-2 font-semibold mx-auto block"
          >
            {mode === "signin" ? "No account? Create one" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </ThemeProvider>
  );
}
