import { sql } from "drizzle-orm";

import { withUser } from "@/server/auth";
import { db } from "@/server/db";

/** Smoke test for the whole stack: Bearer auth → API → Neon. */
export const GET = withUser(async (_req, user) => {
  const started = Date.now();
  await db().execute(sql`select 1`);
  return Response.json({ sub: user.sub, db: { ok: true, ms: Date.now() - started } });
});
