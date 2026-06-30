import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { requestMagicLinkEmail } from "@/lib/email-auth.functions";

import { ThemeProvider } from "@/components/adpalette/theme";
import { BETA_DEMO_EMAIL, BETA_DEMO_PASSWORD, DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/demo-account";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — RevenuAD Signal" },
      { name: "description", content: "Sign in to R-AD. Less prep. Better pitches." },
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
  const [magicSent, setMagicSent] = useState(false);

  const sendMagicLink = async () => {
    if (!email.trim()) {
      toast.error("Enter your email first");
      return;
    }
    setLoading(true);
    try {
      await requestMagicLinkEmail({ data: { email } });
      setMagicSent(true);
      toast.success("Magic link sent — check your inbox.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not send magic link");
    } finally {
      setLoading(false);
    }
  };

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

  const google = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/app` },
    });
    if (error) {
      toast.error(error.message ?? "Google sign-in failed");
      setLoading(false);
    }
  };

  const signInDemo = async (account: "beta" | "legacy" = "beta") => {
    setLoading(true);
    try {
      const email = account === "beta" ? BETA_DEMO_EMAIL : DEMO_EMAIL;
      const password = account === "beta" ? BETA_DEMO_PASSWORD : DEMO_PASSWORD;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Signed in to the live demo (CommBank + Woolworths)");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Demo sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-canvas text-ink grid place-items-center px-6 py-10">
        <div className="w-full max-w-md card-flat p-6 space-y-5">
          <Link to="/" className="flex items-center gap-2" title="The agency world calls us R-AD.">
            <span style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.01em" }}>
              revenuad
            </span>
            <span style={{ fontSize: 16, fontWeight: 600, color: "var(--accent-gold)" }}>.</span>
            <span style={{ fontSize: 16, fontWeight: 500, color: "var(--text-secondary)", marginLeft: 4 }}>
              signal
            </span>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{mode === "signin" ? "Sign in to your workspace" : "Create your workspace"}</h1>
            <p className="text-sm text-muted-foreground mt-1">Less prep. Better pitches.</p>
          </div>

          <button onClick={google} disabled={loading} className="btn-flat w-full justify-center">
            Continue with Google
          </button>

          <button
            type="button"
            onClick={() => void signInDemo("beta")}
            disabled={loading}
            className="btn-flat w-full justify-center"
            style={{ background: "#FDF6E8", borderColor: "#E8D5A0" }}
          >
            Explore live demo (CommBank + Woolworths)
          </button>
          <p className="text-[11px] text-center text-muted-foreground leading-relaxed">
            Media beta: sign in with <strong>{BETA_DEMO_EMAIL}</strong> and the password from your invite.
          </p>

          <div className="flex items-center gap-2 mono text-[11px] text-muted-foreground">
            <div className="flex-1 border-t-2 border-ink" /> OR <div className="flex-1 border-t-2 border-ink" />
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

          {mode === "signin" && (
            <div className="flex flex-col gap-2 items-center">
              <Link to="/forgot-password" className="text-xs underline underline-offset-2 text-muted-foreground">
                Forgot your password?
              </Link>
              <button
                type="button"
                onClick={sendMagicLink}
                disabled={loading}
                className="text-xs underline underline-offset-2 text-muted-foreground"
              >
                {magicSent ? "Magic link sent" : "Email me a sign-in link instead"}
              </button>
            </div>
          )}

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
