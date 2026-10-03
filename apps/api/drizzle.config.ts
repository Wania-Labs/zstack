import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// Precedence: shell env > .env.local > .env.development. dotenv never
// overwrites a variable that is already set, so an explicit
// `DATABASE_URL=… pnpm db:migrate` (e.g. a PlanetScale role) always wins.
config({ path: resolve(root, ".env.local") });
config({ path: resolve(root, ".env.development") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for drizzle-kit (see .env.development)");
}

export default defineConfig({
  out: "./drizzle",
  schema: "./src/platform/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
