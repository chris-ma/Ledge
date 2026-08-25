import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` diffs schema.ts against the migration journal and
// doesn't actually connect to a database, so DATABASE_URL isn't required for
// it — dbCredentials is only exercised if `drizzle-kit push` is run by hand.
// The real, DB-touching migration step is `npm run db:migrate`
// (server/db/migrate.ts), which does its own explicit DATABASE_URL check.
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://placeholder/placeholder";

export default defineConfig({
  schema: "./server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
