import { timingSafeEqual } from "node:crypto";

import { purgeExpired } from "@/server/articles";
import { deleteOrphanedRemovedFeeds } from "@/server/feeds";

/**
 * Daily retention purge, called by Vercel Cron (vercel.json). Vercel sends
 * `Authorization: Bearer $CRON_SECRET`. Not a user API, so no `withUser`.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || got.length !== want.length || !timingSafeEqual(got, want)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const deleted = await purgeExpired();
  await deleteOrphanedRemovedFeeds();
  return Response.json({ deleted });
}
