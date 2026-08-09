import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import AuthPageShell from "@/components/AuthPageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { createTeamSlug, ensureSession } from "@/lib/session";

export const Route = createFileRoute("/onboarding")({
  beforeLoad: async () => {
    await ensureSession({ redirectTo: "/onboarding" });
  },
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError("Team name is required");
      setPending(false);
      return;
    }

    const slug = createTeamSlug(trimmed);

    try {
      const result = await authClient.organization.create({
        name: trimmed,
        slug,
      });
      if (result.error) {
        setError(result.error.message ?? "Could not create team");
        return;
      }

      await authClient.organization.setActive({ organizationSlug: slug });
      await navigate({
        to: "/t/$organizationSlug",
        params: { organizationSlug: slug },
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthPageShell
      title="Name your Team"
      description="Every workspace belongs to a Team. You become its owner."
    >
      <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="team-name">Team name</FieldLabel>
            <Input
              id="team-name"
              required
              autoComplete="organization"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Acme"
            />
            <FieldDescription>
              You can rename it later. The URL slug is generated for you.
            </FieldDescription>
          </Field>
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Could not create Team</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </FieldGroup>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {pending ? "Creating…" : "Create Team"}
        </Button>
      </form>
    </AuthPageShell>
  );
}
