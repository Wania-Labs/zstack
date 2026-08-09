export type ConsoleUser = {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  emailVerified: boolean;
  createdAt: Date;
  image?: string | null;
};

export type ListUsersResponse = {
  users: ConsoleUser[];
  total: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseCreatedAt(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }
  return null;
}

function parseConsoleUser(value: unknown): ConsoleUser | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = value.id;
  const name = value.name;
  const email = value.email;
  const emailVerified = value.emailVerified;
  const createdAt = parseCreatedAt(value.createdAt);

  if (typeof id !== "string" || id.length === 0) return null;
  if (typeof name !== "string") return null;
  if (typeof email !== "string" || !email.includes("@")) return null;
  if (typeof emailVerified !== "boolean") return null;
  if (!createdAt) return null;

  const role = value.role;
  if (role !== undefined && role !== null && typeof role !== "string") {
    return null;
  }

  const image = value.image;
  if (image !== undefined && image !== null && typeof image !== "string") {
    return null;
  }

  const user: ConsoleUser = {
    id,
    name,
    email,
    emailVerified,
    createdAt,
  };

  if (role !== undefined) {
    user.role = role;
  }
  if (image !== undefined) {
    user.image = image;
  }

  return user;
}

export function parseListUsersResponse(value: unknown): ListUsersResponse {
  if (!isRecord(value)) {
    throw new Error("Invalid list users response");
  }

  if (!Array.isArray(value.users) || typeof value.total !== "number") {
    throw new Error("Invalid list users response");
  }

  const users: ConsoleUser[] = [];
  for (const entry of value.users) {
    const user = parseConsoleUser(entry);
    if (!user) {
      throw new Error("Invalid user row in list users response");
    }
    users.push(user);
  }

  return { users, total: value.total };
}
