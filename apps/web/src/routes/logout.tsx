import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import AuthPageShell from "@/components/AuthPageShell";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/logout")({
  component: LogoutPage,
});

function LogoutPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const result = await authClient.signOut();
      if (cancelled) {
        return;
      }
      if (result.error) {
        setError(result.error.message ?? "Sign out failed");
        return;
      }
      await navigate({ to: "/login" });
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <AuthPageShell title="Signing out">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        {error ?? "Ending your session…"}
      </div>
    </AuthPageShell>
  );
}
