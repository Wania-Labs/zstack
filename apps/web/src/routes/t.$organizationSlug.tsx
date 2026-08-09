import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import AppShell from "@/components/AppShell";
import { authClient } from "@/lib/auth-client";
import { ensureSession, listTeams, resolveAppDestination } from "@/lib/session";

export const Route = createFileRoute("/t/$organizationSlug")({
  beforeLoad: async ({ params }) => {
    const auth = await ensureSession({
      redirectTo: `/t/${params.organizationSlug}`,
    });
    const teams = await listTeams();
    if (teams.length === 0) {
      throw redirect({ to: "/onboarding" });
    }

    const team = teams.find((item) => item.slug === params.organizationSlug);
    if (!team) {
      throw redirect(
        resolveAppDestination({
          teams,
          activeOrganizationId: auth.activeOrganizationId,
        }),
      );
    }

    await authClient.organization.setActive({
      organizationSlug: team.slug,
    });

    return { auth, team, teams };
  },
  component: TeamLayout,
});

function TeamLayout() {
  const { auth, team, teams } = Route.useRouteContext();

  return (
    <AppShell
      user={auth.user}
      teams={teams}
      organizationSlug={team.slug}
      organizationName={team.name}
    >
      <Outlet />
    </AppShell>
  );
}
