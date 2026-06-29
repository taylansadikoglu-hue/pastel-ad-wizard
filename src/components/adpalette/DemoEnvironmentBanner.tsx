import { useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useDemoAccount } from "@/contexts/DemoAccountContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Props = {
  variant?: "default" | "dark-dense";
};

/** Persistent demo notice + trial CTA for read-only CommBank showcase sessions. */
export function DemoEnvironmentBanner({ variant = "default" }: Props) {
  const { isDemo, loading } = useDemoAccount();
  const navigate = useNavigate();
  const isDense = variant === "dark-dense";

  if (loading || !isDemo) return null;

  const startTrial = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div
      className={cn(
        "shrink-0 border-b",
        isDense ? "border-neutral-800 bg-neutral-900/90" : "border-[#E8D5A0] bg-[#FDF6E8]",
      )}
      style={{ padding: "10px 20px" }}
    >
      <div
        className="mx-auto flex flex-wrap items-center justify-between gap-3"
        style={{ maxWidth: 1440 }}
      >
        <p
          className={cn("text-sm leading-snug m-0", isDense ? "text-neutral-300" : "text-[#6B6B62]")}
        >
          This is a live demo environment using{" "}
          <strong className={cn(isDense ? "text-neutral-100" : "text-[#1C1C1A]")}>CommBank</strong> and{" "}
          <strong className={cn(isDense ? "text-neutral-100" : "text-[#1C1C1A]")}>Banking</strong> data.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={cn(isDense ? "text-neutral-400" : "text-[#6B6B62]")}>
            Want your own clients and competitors?
          </span>
          <button
            type="button"
            onClick={() => void startTrial()}
            className={cn(
              "inline-flex items-center gap-1 font-semibold border-none bg-transparent p-0 cursor-pointer",
              isDense ? "text-amber-400 hover:text-amber-300" : "text-[#C9963A] hover:text-[#A67A2E]",
            )}
          >
            Start a trial <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
