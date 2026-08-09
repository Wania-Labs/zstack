import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/t/$organizationSlug/members")({
  component: TeamMembersPage,
});

type MemberRow = {
  id: string;
  role: string;
  userId: string;
  name: string;
  email: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseMember(value: unknown): MemberRow | null {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.id !== "string") {
    return null;
  }
  if (typeof value.role !== "string") {
    return null;
  }
  if (typeof value.userId !== "string") {
    return null;
  }

  const user = isRecord(value.user) ? value.user : null;
  const name =
    (user && typeof user.name === "string" && user.name) ||
    (typeof value.name === "string" ? value.name : null);
  const email =
    (user && typeof user.email === "string" && user.email) ||
    (typeof value.email === "string" ? value.email : null);
  if (!name || !email) {
    return null;
  }

  return {
    id: value.id,
    role: value.role,
    userId: value.userId,
    name,
    email,
  };
}

function parseMembers(data: unknown): MemberRow[] {
  if (!isRecord(data) || !Array.isArray(data.members)) {
    throw new Error("Unexpected members payload");
  }
  const rows: MemberRow[] = [];
  for (const item of data.members) {
    const member = parseMember(item);
    if (!member) {
      throw new Error("Unexpected member row");
    }
    rows.push(member);
  }
  return rows;
}

function TeamMembersPage() {
  const { organizationSlug } = Route.useParams();
  const { team } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);

  const membersQuery = useQuery({
    queryKey: ["team-members", team.id],
    queryFn: async () => {
      const result = await authClient.organization.listMembers({
        query: { organizationId: team.id },
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Failed to load members");
      }
      return parseMembers(result.data);
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (inviteEmail: string) => {
      const result = await authClient.organization.inviteMember({
        email: inviteEmail,
        role: "member",
        organizationId: team.id,
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Invite failed");
      }
      return result.data;
    },
    onSuccess: async (_data, inviteEmail) => {
      setEmail("");
      setInviteError(null);
      setInviteNotice(`Invite sent to ${inviteEmail}. They join via the email link.`);
      await queryClient.invalidateQueries({ queryKey: ["team-members", team.id] });
    },
    onError: (error: Error) => {
      setInviteNotice(null);
      setInviteError(error.message);
    },
  });

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
        <p className="text-muted-foreground">
          Example team feature under <code>/t/{organizationSlug}/members</code>. List and invite
          with Better Auth organization APIs.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Invite</h2>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setInviteError(null);
            setInviteNotice(null);
            inviteMutation.mutate(email.trim());
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="invite-email">Email</FieldLabel>
              <Input
                id="invite-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            {inviteError ? (
              <Field data-invalid>
                <FieldError>{inviteError}</FieldError>
              </Field>
            ) : null}
            {inviteNotice ? (
              <Alert>
                <AlertTitle>Invite sent</AlertTitle>
                <AlertDescription>{inviteNotice}</AlertDescription>
              </Alert>
            ) : null}
          </FieldGroup>
          <Button type="submit" disabled={inviteMutation.isPending} className="w-fit">
            {inviteMutation.isPending ? <Spinner data-icon="inline-start" /> : null}
            {inviteMutation.isPending ? "Sending…" : "Send invite"}
          </Button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Current members</h2>
        {membersQuery.isPending ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            Loading…
          </div>
        ) : null}
        {membersQuery.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load members</AlertTitle>
            <AlertDescription>
              {membersQuery.error instanceof Error ? membersQuery.error.message : "Unknown error"}
            </AlertDescription>
          </Alert>
        ) : null}
        {membersQuery.data ? (
          <ul className="divide-y rounded-lg border">
            {membersQuery.data.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{member.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                </div>
                <Badge variant="secondary">{member.role}</Badge>
              </li>
            ))}
            {membersQuery.data.length === 0 ? (
              <li className="px-4 py-3 text-sm text-muted-foreground">No members yet.</li>
            ) : null}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
