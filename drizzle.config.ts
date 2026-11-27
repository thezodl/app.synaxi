import { defineConfig } from "drizzle-kit";

// Migrations are generated (`bun run db:generate`), committed, and append-only.
// Use the *unpooled* Neon connection string for migrations.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
