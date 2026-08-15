import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { AppShell } from "@/components/AppShell";
import { SignOutButton } from "@/components/UserMenu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";

type StaffGateProps = {
  children: ReactNode;
};

export function StaffGate({ children }: StaffGateProps) {
  const session = authClient.useSession();
  const email = session.data?.user.email;
  const hasUser = Boolean(session.data?.user);

  const staffQuery = useQuery({
    ...orpc.staff.me.queryOptions(),
    enabled: hasUser,
    retry: false,
  });

  if (session.isPending) {
    return (
      <div className="flex min-h-svh items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        Checking staff access…
      </div>
    );
  }

  if (!hasUser) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col justify-center gap-4 px-4">
        <Alert variant="destructive">
          <AlertTitle>Signed out</AlertTitle>
          <AlertDescription>Sign in again to open the staff console.</AlertDescription>
        </Alert>
        <SignOutButton />
      </div>
    );
  }

  if (staffQuery.isPending) {
    return (
      <div className="flex min-h-svh items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        Checking staff access…
      </div>
    );
  }

  if (staffQuery.isError || !staffQuery.data) {
    const code = readErrorCode(staffQuery.error);
    if (code === "UNAUTHORIZED") {
      return (
        <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col justify-center gap-4 px-4">
          <Alert variant="destructive">
            <AlertTitle>Signed out</AlertTitle>
            <AlertDescription>Sign in again to open the staff console.</AlertDescription>
          </Alert>
          <SignOutButton />
        </div>
      );
    }

    if (code !== "FORBIDDEN") {
      return (
        <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col justify-center gap-4 px-4">
          <Alert variant="destructive">
            <AlertTitle>Staff check failed</AlertTitle>
            <AlertDescription>
              Signed in as {email ?? "unknown"}, but the staff check did not complete. Retry after
              the API is reachable.
            </AlertDescription>
          </Alert>
          <SignOutButton />
        </div>
      );
    }

    return (
      <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col justify-center gap-4 px-4">
        <Alert variant="destructive">
          <AlertTitle>Not staff</AlertTitle>
          <AlertDescription>
            Signed in as {email ?? "unknown"}, but this account has no staff role. Bootstrap the
            first admin with <code>STAFF_EMAIL={email ?? "you@example.com"} pnpm db:seed</code>,
            then promote others from Users.
          </AlertDescription>
        </Alert>
        <SignOutButton />
      </div>
    );
  }

  return <AppShell staff={staffQuery.data}>{children}</AppShell>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readErrorCode(error: unknown): string | undefined {
  if (!isRecord(error)) {
    return undefined;
  }
  if (typeof error.code === "string") {
    return error.code;
  }
  if (isRecord(error.data) && typeof error.data.code === "string") {
    return error.data.code;
  }
  if (isRecord(error.cause) && typeof error.cause.code === "string") {
    return error.cause.code;
  }
  return undefined;
}
