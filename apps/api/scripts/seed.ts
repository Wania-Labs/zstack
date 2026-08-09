import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

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
  const value = "1";

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
} finally {
  await client.end();
}
