import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { requestPasswordResetEmail } from "@/lib/email-auth.functions";
import { ThemeProvider } from "@/components/adpalette/theme";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset password — RevenuAD Signal" },
      { name: "description", content: "Reset the password for your RevenuAD Signal workspace." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await requestPasswordResetEmail({ data: { email } });
      setSent(true);
      toast.success("Reset link sent. Check your inbox.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-canvas text-ink grid place-items-center px-6 py-10">
        <div className="w-full max-w-md card-flat p-6 space-y-5">
          <button onClick={() => navigate({ to: "/auth" })} className="flex items-center gap-2 mono text-[11px] text-muted-foreground hover:text-ink">
            <ArrowLeft size={12} /> Back to sign in
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enter the email tied to your workspace. We'll send you a secure link to set a new password.
            </p>
          </div>

          {sent ? (
            <div className="card-flat p-5 bg-secondary/40 text-sm space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <Mail size={14} /> Check your email
              </div>
              <p className="text-muted-foreground">
                If an account exists for <span className="font-medium text-ink">{email}</span>, a reset link is on its way.
                The link expires in 1 hour.
              </p>
              <Link to="/auth" className="btn-flat mt-3 inline-flex">Return to sign in</Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="mono text-[11px] font-bold">EMAIL</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-flat mt-1"
                  placeholder="you@agency.com"
                />
              </div>
              <button type="submit" disabled={loading} className="btn-flat btn-primary w-full justify-center">
                {loading ? <Loader2 size={14} className="animate-spin" /> : "Send reset link"}
              </button>
            </form>
          )}
        </div>
      </div>
    </ThemeProvider>
  );
}
