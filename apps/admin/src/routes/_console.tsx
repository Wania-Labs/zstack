import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { StaffGate } from "@/components/StaffGate";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_console")({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: "/login" });
    }
  },
  component: ConsoleLayout,
});

function ConsoleLayout() {
  return (
    <StaffGate>
      <Outlet />
    </StaffGate>
  );
}
