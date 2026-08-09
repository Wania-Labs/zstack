import { Link, createFileRoute } from "@tanstack/react-router";
import { UsersIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_console/")({
  component: ConsoleHomePage,
});

function ConsoleHomePage() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <Badge variant="secondary">console</Badge>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Staff console home. Use Users to search accounts and set staff roles without re-seeding.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/users" className="no-underline">
          <Card className="h-full transition-colors hover:bg-muted/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UsersIcon className="size-4" />
                Users
              </CardTitle>
              <CardDescription>
                List and search users. Promote to admin, support, operations, or owner.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-sm text-foreground">Open Users →</span>
            </CardContent>
          </Card>
        </Link>

        <Card className="h-full opacity-60">
          <CardHeader>
            <CardTitle className="text-base">Orgs</CardTitle>
            <CardDescription>Organization ops land in a later slice.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </>
  );
}
