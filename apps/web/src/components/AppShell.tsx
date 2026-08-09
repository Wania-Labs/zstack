import { Link } from "@tanstack/react-router";
import { HomeIcon, UsersIcon } from "lucide-react";

import ThemeToggle from "@/components/ThemeToggle";
import { TeamSwitcher, UserMenu } from "@/components/UserMenu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import type { SessionUser, TeamSummary } from "@/lib/session";

export default function AppShell({
  user,
  teams,
  organizationSlug,
  organizationName,
  children,
}: {
  user: SessionUser;
  teams: TeamSummary[];
  organizationSlug: string;
  organizationName: string;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="gap-3 p-3">
          <Link
            to="/t/$organizationSlug"
            params={{ organizationSlug }}
            className="px-1 text-sm font-semibold tracking-tight text-sidebar-foreground no-underline"
          >
            zstack
          </Link>
          <TeamSwitcher teams={teams} currentSlug={organizationSlug} />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={
                      <Link
                        to="/t/$organizationSlug"
                        params={{ organizationSlug }}
                        activeOptions={{ exact: true }}
                      />
                    }
                    tooltip="Home"
                  >
                    <HomeIcon />
                    <span>Home</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={
                      <Link
                        to="/t/$organizationSlug/members"
                        params={{ organizationSlug }}
                      />
                    }
                    tooltip="Members"
                  >
                    <UsersIcon />
                    <span>Members</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="p-3">
          <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col">
            <UserMenu user={user} />
            <ThemeToggle />
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{organizationName}</span>
            <span className="truncate text-xs text-muted-foreground">/{organizationSlug}</span>
          </div>
        </header>
        <div className="flex flex-1 flex-col p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
