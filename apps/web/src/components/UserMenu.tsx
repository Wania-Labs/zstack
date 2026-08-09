import { useNavigate } from "@tanstack/react-router";
import { ChevronsUpDownIcon, LogOutIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SessionUser, TeamSummary } from "@/lib/session";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  const first = parts[0]?.[0];
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] : undefined;
  return `${first ?? ""}${second ?? ""}`.toUpperCase() || "?";
}

export function UserMenu({ user }: { user: SessionUser }) {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="h-9 gap-2 px-2">
            <Avatar size="sm">
              {user.image ? <AvatarImage src={user.image} alt="" /> : null}
              <AvatarFallback>{initials(user.name)}</AvatarFallback>
            </Avatar>
            <span className="max-w-28 truncate text-left text-sm">{user.name}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{user.name}</span>
            <span className="text-xs text-muted-foreground">{user.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            void navigate({ to: "/logout" });
          }}
        >
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TeamSwitcher({
  teams,
  currentSlug,
}: {
  teams: TeamSummary[];
  currentSlug: string;
}) {
  const navigate = useNavigate();
  const current = teams.find((team) => team.slug === currentSlug) ?? teams[0];

  if (!current) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="w-full justify-between gap-2">
            <span className="truncate">{current.name}</span>
            <ChevronsUpDownIcon className="size-3.5 opacity-60" />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuLabel>Teams</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {teams.map((team) => (
          <DropdownMenuItem
            key={team.id}
            onClick={() => {
              void navigate({
                to: "/t/$organizationSlug",
                params: { organizationSlug: team.slug },
              });
            }}
          >
            <span className="truncate">{team.name}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            void navigate({ to: "/onboarding" });
          }}
        >
          Create team
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
