import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as m from "@zstack/i18n/messages";
import { useEffect, useState } from "react";

import AuthPageShell from "@/components/AuthPageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { ensureSession } from "@/lib/session";

type InvitationDetails = {
  id: string;
  email: string;
  role: string | null;
  organizationName: string;
  organizationSlug: string;
  inviterEmail: string;
};

type PageState =
  | { kind: "loading" }
  | { kind: "ready"; invitation: InvitationDetails }
  | { kind: "error"; message: string }
  | { kind: "accepted"; organizationSlug: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseInvitation(value: unknown): InvitationDetails | null {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.id !== "string") {
    return null;
  }
  if (typeof value.email !== "string") {
    return null;
  }

  const organization = value.organizationName
    ? null
    : isRecord(value.organization)
      ? value.organization
      : null;

  const organizationName =
    typeof value.organizationName === "string"
      ? value.organizationName
      : organization && typeof organization.name === "string"
        ? organization.name
        : null;
  const organizationSlug =
    typeof value.organizationSlug === "string"
      ? value.organizationSlug
      : organization && typeof organization.slug === "string"
        ? organization.slug
        : null;

  if (!organizationName || !organizationSlug) {
    return null;
  }

  const inviter = isRecord(value.inviter) ? value.inviter : null;
  const inviterUser = inviter && isRecord(inviter.user) ? inviter.user : null;
  const inviterEmail =
    typeof value.inviterEmail === "string"
      ? value.inviterEmail
      : inviterUser && typeof inviterUser.email === "string"
        ? inviterUser.email
        : inviter && typeof inviter.email === "string"
          ? inviter.email
          : "a teammate";

  const role = typeof value.role === "string" ? value.role : null;

  return {
    id: value.id,
    email: value.email,
    role,
    organizationName,
    organizationSlug,
    inviterEmail,
  };
}

export const Route = createFileRoute("/accept-invitation/$invitationId")({
  beforeLoad: async ({ params }) => {
    await ensureSession({
      redirectTo: `/accept-invitation/${params.invitationId}`,
    });
  },
  component: AcceptInvitationPage,
});

function AcceptInvitationPage() {
  const { invitationId } = Route.useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const result = await authClient.organization.getInvitation({
        query: { id: invitationId },
      });
      if (cancelled) {
        return;
      }
      if (result.error) {
        setState({
          kind: "error",
          message: result.error.message ?? m["auth.acceptInvitation.errorNotFound"](),
        });
        return;
      }
      const invitation = parseInvitation(result.data);
      if (!invitation) {
        setState({
          kind: "error",
          message: m["auth.acceptInvitation.errorUnexpected"](),
        });
        return;
      }
      setState({ kind: "ready", invitation });
    })();

    return () => {
      cancelled = true;
    };
  }, [invitationId]);

  async function onAccept() {
    if (state.kind !== "ready") {
      return;
    }
    setPending(true);
    try {
      const result = await authClient.organization.acceptInvitation({
        invitationId,
      });
      if (result.error) {
        setState({
          kind: "error",
          message: result.error.message ?? m["auth.acceptInvitation.errorAcceptFallback"](),
        });
        return;
      }

      await authClient.organization.setActive({
        organizationSlug: state.invitation.organizationSlug,
      });
      setState({
        kind: "accepted",
        organizationSlug: state.invitation.organizationSlug,
      });
      await navigate({
        to: "/t/$organizationSlug",
        params: { organizationSlug: state.invitation.organizationSlug },
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthPageShell
      title={m["auth.acceptInvitation.title"]()}
      description={m["auth.acceptInvitation.description"]()}
    >
      {state.kind === "loading" ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          {m["auth.acceptInvitation.loading"]()}
        </div>
      ) : null}

      {state.kind === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>{m["auth.acceptInvitation.errorTitle"]()}</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {state.kind === "ready" ? (
        <div className="flex flex-col gap-4">
          <Alert>
            <AlertTitle>{state.invitation.organizationName}</AlertTitle>
            <AlertDescription>
              {state.invitation.inviterEmail} {m["auth.acceptInvitation.invited"]()}{" "}
              {state.invitation.email}
              {state.invitation.role
                ? ` ${m["auth.acceptInvitation.as"]()} ${state.invitation.role}`
                : ""}
              .
            </AlertDescription>
          </Alert>
          <Button type="button" disabled={pending} onClick={() => void onAccept()}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {pending
              ? m["auth.acceptInvitation.submitPending"]()
              : m["auth.acceptInvitation.submit"]()}
          </Button>
        </div>
      ) : null}

      {state.kind === "accepted" ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          {m["auth.acceptInvitation.accepted"]()}
        </div>
      ) : null}
    </AuthPageShell>
  );
}
