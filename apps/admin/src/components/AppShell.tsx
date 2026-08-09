import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboardIcon, UsersIcon } from "lucide-react";
import type { ReactNode } from "react";

import ThemeToggle from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StaffMeResponse } from "@zstack/contracts/staff";

type AppShellProps = {
  staff: StaffMeResponse;
  children: ReactNode;
};

type NavItem = {
  to: "/";
  label: string;
  icon: typeof LayoutDashboardIcon;
  enabled: true;
} | {
  to: "/users";
  label: string;
  icon: typeof UsersIcon;
  enabled: true;
} | {
  label: string;
  enabled: false;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Overview", icon: LayoutDashboardIcon, enabled: true },
  { to: "/users", label: "Users", icon: UsersIcon, enabled: true },
  { label: "Orgs", enabled: false },
  { label: "Billing", enabled: false },
];

export function AppShell({ staff, children }: AppShellProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="flex min-h-svh w-full bg-background">
      <aside className="hidden w-56 shrink-0 flex-col border-r bg-background md:flex">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Link to="/" className="text-sm font-semibold tracking-tight text-foreground no-underline">
            zstack admin
          </Link>
          <Badge variant="secondary" className="text-[10px]">
            staff
          </Badge>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2">
          {NAV_ITEMS.map((item) => {
            if (!item.enabled) {
              return (
                <span
                  key={item.label}
                  className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground/60"
                  title="Coming later"
                >
                  {item.label}
                </span>
              );
            }

            const Icon = item.icon;
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);

            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm no-underline transition-colors",
                  active
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur-lg">
          <div className="flex items-center gap-3 md:hidden">
            <Link to="/" className="text-sm font-semibold tracking-tight no-underline">
              zstack admin
            </Link>
            <nav className="flex items-center gap-1">
              <Link
                to="/"
                className={cn(
                  "rounded-md px-2 py-1 text-xs no-underline",
                  pathname === "/" ? "bg-muted font-medium" : "text-muted-foreground",
                )}
              >
                Overview
              </Link>
              <Link
                to="/users"
                className={cn(
                  "rounded-md px-2 py-1 text-xs no-underline",
                  pathname.startsWith("/users") ? "bg-muted font-medium" : "text-muted-foreground",
                )}
              >
                Users
              </Link>
            </nav>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <UserMenu name={staff.name} email={staff.email} role={staff.role} />
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
