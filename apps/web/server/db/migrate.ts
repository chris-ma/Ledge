import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Run `vercel env pull .env` after connecting " +
        "Neon via the Vercel project's Storage tab.",
    );
  }

  const sql = neon(databaseUrl);
  const db = drizzle(sql);

  // The ledges.geog column is `geography(Point,4326)`, which requires PostGIS.
  // This must run before the generated migration that creates the ledges
  // table, so it's handled here rather than left to drizzle-kit (which only
  // knows about tables/columns declared in schema.ts, not extensions).
  console.log("Ensuring postgis extension exists...");
  await sql`CREATE EXTENSION IF NOT EXISTS postgis`;

  console.log("Applying drizzle migrations from ./drizzle ...");
  await migrate(db, { migrationsFolder: "./drizzle" });

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
