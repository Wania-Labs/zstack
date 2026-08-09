import { useRouter } from "@tanstack/react-router";
import { LogOutIcon } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";

type UserMenuProps = {
  name: string;
  email: string;
  role: string | null;
};

function initials(name: string, email: string): string {
  const source = name.trim() || email.trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase() || "?";
}

export function UserMenu({ name, email, role }: UserMenuProps) {
  const router = useRouter();

  async function onSignOut() {
    await authClient.signOut();
    await router.navigate({ to: "/login" });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="ghost" size="sm" className="gap-2 px-1.5">
            <Avatar size="sm">
              <AvatarFallback>{initials(name, email)}</AvatarFallback>
            </Avatar>
            <span className="hidden max-w-40 truncate text-left text-sm sm:block">{email}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{name}</span>
            <span className="text-xs text-muted-foreground">{email}</span>
            {role ? <span className="text-xs text-muted-foreground">Role: {role}</span> : null}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void onSignOut()}>
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SignOutButton() {
  const router = useRouter();

  async function onSignOut() {
    await authClient.signOut();
    await router.navigate({ to: "/login" });
  }

  return (
    <Button type="button" variant="outline" onClick={() => void onSignOut()}>
      Sign out
    </Button>
  );
}
