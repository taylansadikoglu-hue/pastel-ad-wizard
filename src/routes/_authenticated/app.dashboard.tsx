import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/dashboard")({
  head: () => ({ meta: [{ title: "Market Intel — RevenuAD Signal" }] }),
  beforeLoad: () => {
    throw redirect({ to: "/app/pcr" });
  },
});
