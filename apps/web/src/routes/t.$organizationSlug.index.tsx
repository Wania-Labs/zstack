import { Link, createFileRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/t/$organizationSlug/")({
  component: TeamHomePage,
});

function TeamHomePage() {
  const { team } = Route.useRouteContext();

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{team.name}</h1>
        <p className="text-muted-foreground">
          Team home. Hang product features under <code>/t/{team.slug}</code>. Start from the Members
          example.
        </p>
      </div>
      <Button
        render={<Link to="/t/$organizationSlug/members" params={{ organizationSlug: team.slug }} />}
        variant="outline"
        className="w-fit"
      >
        View members
      </Button>
    </div>
  );
}
