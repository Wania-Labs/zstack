import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

import { user } from "../src/platform/db/auth-schema";
import { schemaMeta } from "../src/platform/db/schema";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

config({ path: resolve(root, ".env.development") });
config({ path: resolve(root, ".env.local"), override: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for seed");
}

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  const db = drizzle({ client });
  const key = "seed_version";
  const value = "2";

  const existing = await db.select().from(schemaMeta).where(eq(schemaMeta.key, key)).limit(1);
  if (existing[0]) {
    await db
      .update(schemaMeta)
      .set({ value, updatedAt: new Date() })
      .where(eq(schemaMeta.key, key));
  } else {
    await db.insert(schemaMeta).values({ key, value });
  }

  console.log(`seeded ${key}=${value}`);

  const staffEmail = process.env.STAFF_EMAIL?.trim();
  if (staffEmail) {
    const updated = await db
      .update(user)
      .set({ role: "admin" })
      .where(eq(user.email, staffEmail))
      .returning({ id: user.id, email: user.email, role: user.role });

    if (updated[0]) {
      console.log(`promoted staff ${updated[0].email} role=${updated[0].role}`);
    } else {
      console.warn(`STAFF_EMAIL=${staffEmail} not found — sign up first, then re-seed`);
    }
  }
} finally {
  await client.end();
}
