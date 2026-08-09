import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

import * as authSchema from "./auth-schema";

/**
 * App-owned bootstrap metadata. Auth tables come from Better Auth CLI output.
 */
export const schemaMeta = pgTable("schema_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const schema = {
  schemaMeta,
  ...authSchema,
};

export * from "./auth-schema";
