import { Link, createFileRoute } from "@tanstack/react-router";
import * as m from "@zstack/i18n/messages";
import { useEffect, useState } from "react";

import AuthPageShell from "@/components/AuthPageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { parseTokenSearch } from "@/lib/auth-search";

type VerifyState =
  | { kind: "missing-token" }
  | { kind: "pending" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export const Route = createFileRoute("/verify-email")({
  validateSearch: parseTokenSearch,
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const search = Route.useSearch();
  const [state, setState] = useState<VerifyState>(() =>
    search.token ? { kind: "pending" } : { kind: "missing-token" },
  );

  useEffect(() => {
    const token = search.token;
    if (!token) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const result = await authClient.verifyEmail({
        query: { token },
      });
      if (cancelled) {
        return;
      }
      if (result.error) {
        setState({
          kind: "error",
          message: result.error.message ?? m["auth.verifyEmail.errorFallback"](),
        });
        return;
      }
      setState({ kind: "success" });
    })();

    return () => {
      cancelled = true;
    };
  }, [search.token]);

  return (
    <AuthPageShell
      title={m["auth.verifyEmail.title"]()}
      description={m["auth.verifyEmail.description"]()}
    >
      {state.kind === "missing-token" ? (
        <Alert variant="destructive">
          <AlertTitle>{m["auth.verifyEmail.missingTokenTitle"]()}</AlertTitle>
          <AlertDescription>{m["auth.verifyEmail.missingTokenDescription"]()}</AlertDescription>
        </Alert>
      ) : null}
      {state.kind === "pending" ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          {m["auth.verifyEmail.pending"]()}
        </div>
      ) : null}
      {state.kind === "success" ? (
        <Alert>
          <AlertTitle>{m["auth.verifyEmail.successTitle"]()}</AlertTitle>
          <AlertDescription>
            {m["auth.verifyEmail.successDescription"]()}{" "}
            <Link to="/login" className="underline underline-offset-4">
              {m["auth.verifyEmail.signInLink"]()}
            </Link>{" "}
            {m["auth.verifyEmail.toContinue"]()}
          </AlertDescription>
        </Alert>
      ) : null}
      {state.kind === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>{m["auth.verifyEmail.errorTitle"]()}</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      {search.error ? (
        <Alert variant="destructive">
          <AlertTitle>{m["auth.verifyEmail.linkErrorTitle"]()}</AlertTitle>
          <AlertDescription>{search.error}</AlertDescription>
        </Alert>
      ) : null}
    </AuthPageShell>
  );
}
