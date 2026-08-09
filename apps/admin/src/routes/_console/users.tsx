import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StaffRole } from "@zstack/contracts/staff";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { authClient } from "@/lib/auth-client";
import { parseListUsersResponse, type ConsoleUser } from "@/lib/console-users";
import { orpc } from "@/lib/orpc";
import {
  ASSIGNABLE_ROLES,
  ROLE_LABELS,
  formatRole,
  parseAssignableRole,
  type AssignableRole,
} from "@/lib/staff-roles";

export const Route = createFileRoute("/_console/users")({
  component: UsersPage,
});

const USERS_QUERY_KEY = ["admin", "list-users"] as const;

async function listUsers(search: string) {
  const result = await authClient.admin.listUsers({
    query: {
      limit: 50,
      offset: 0,
      sortBy: "createdAt",
      sortDirection: "desc",
      ...(search.trim()
        ? {
            searchValue: search.trim(),
            searchField: "email",
            searchOperator: "contains",
          }
        : {}),
    },
  });

  if (result.error) {
    throw new Error(result.error.message ?? "Failed to list users");
  }

  return parseListUsersResponse(result.data);
}

function canManageRoles(role: string | null): boolean {
  const parsed = StaffRole.safeParse(role);
  return parsed.success && (parsed.data === "admin" || parsed.data === "owner");
}

function UsersPage() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const meQuery = useQuery({
    ...orpc.staff.me.queryOptions(),
  });
  const manageRoles = canManageRoles(meQuery.data?.role ?? null);

  const usersQuery = useQuery({
    queryKey: [...USERS_QUERY_KEY, search],
    queryFn: () => listUsers(search),
  });

  const setRoleMutation = useMutation({
    mutationFn: async (input: { userId: string; role: AssignableRole }) => {
      const result = await authClient.admin.setRole({
        userId: input.userId,
        role: input.role,
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Failed to set role");
      }
      return result.data;
    },
    onSuccess: async () => {
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
    onError: (error: Error) => {
      setActionError(error.message);
    },
  });

  function onSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput);
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <Badge variant="secondary">management</Badge>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Search accounts via Better Auth admin.
          {manageRoles
            ? " Admin and owner can set staff roles. Clearing staff sets role to user."
            : " Role changes require an admin or owner account."}
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3" onSubmit={onSearchSubmit}>
        <Field className="min-w-64 flex-1">
          <FieldLabel htmlFor="user-search">Search by email</FieldLabel>
          <Input
            id="user-search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="contains…"
            autoComplete="off"
          />
        </Field>
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {actionError ? (
        <Field data-invalid>
          <FieldError>{actionError}</FieldError>
        </Field>
      ) : null}

      {usersQuery.isPending ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          Loading users…
        </div>
      ) : null}

      {usersQuery.isError ? (
        <Field data-invalid>
          <FieldError>
            {usersQuery.error instanceof Error
              ? usersQuery.error.message
              : "Failed to load users"}
          </FieldError>
        </Field>
      ) : null}

      {usersQuery.data ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {usersQuery.data.total} user{usersQuery.data.total === 1 ? "" : "s"}
            {search ? ` matching “${search}”` : ""}
          </p>
          <UsersTable
            users={usersQuery.data.users}
            canManageRoles={manageRoles}
            pendingUserId={
              setRoleMutation.isPending ? setRoleMutation.variables?.userId : undefined
            }
            onRoleChange={(userId, role) => {
              setRoleMutation.mutate({ userId, role });
            }}
          />
        </div>
      ) : null}
    </>
  );
}

type UsersTableProps = {
  users: ConsoleUser[];
  canManageRoles: boolean;
  pendingUserId: string | undefined;
  onRoleChange: (userId: string, role: AssignableRole) => void;
};

function UsersTable({ users, canManageRoles, pendingUserId, onRoleChange }: UsersTableProps) {
  if (users.length === 0) {
    return <p className="text-sm text-muted-foreground">No users found.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Verified</TableHead>
          <TableHead>Created</TableHead>
          {canManageRoles ? <TableHead className="w-48">Set role</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => {
          const current = parseAssignableRole(user.role);
          const busy = pendingUserId === user.id;

          return (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.name || "—"}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>
                <Badge variant="secondary">{formatRole(user.role)}</Badge>
              </TableCell>
              <TableCell>{user.emailVerified ? "Yes" : "No"}</TableCell>
              <TableCell className="text-muted-foreground">
                {user.createdAt.toLocaleDateString()}
              </TableCell>
              {canManageRoles ? (
                <TableCell>
                  <FieldGroup className="gap-0">
                    <Select
                      value={current}
                      disabled={busy}
                      onValueChange={(value) => {
                        if (value == null) return;
                        const parsed = parseAssignableRole(String(value));
                        if (parsed === current) return;
                        onRoleChange(user.id, parsed);
                      }}
                    >
                      <SelectTrigger size="sm" className="w-full min-w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSIGNABLE_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldGroup>
                </TableCell>
              ) : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
