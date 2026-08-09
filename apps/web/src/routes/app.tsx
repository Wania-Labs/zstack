import { createFileRoute, redirect } from "@tanstack/react-router";

import { Spinner } from "@/components/ui/spinner";
import { ensureSession, listTeams, resolveAppDestination } from "@/lib/session";

export const Route = createFileRoute("/app")({
  beforeLoad: async () => {
    const auth = await ensureSession();
    const teams = await listTeams();
    throw redirect(
      resolveAppDestination({
        teams,
        activeOrganizationId: auth.activeOrganizationId,
      }),
    );
  },
  component: AppRedirectPage,
});

function AppRedirectPage() {
  return (
    <div className="flex min-h-svh items-center justify-center gap-2 text-sm text-muted-foreground">
      <Spinner />
      Opening app…
    </div>
  );
}
