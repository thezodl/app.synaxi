import { withUser } from "@/server/auth";
import { syncAll } from "@/server/sync";

// Fetching ~50 feeds at concurrency 6 with 20s timeouts fits comfortably.
export const maxDuration = 300;

/** POST /api/sync[?auto=1]. `auto` (app open) is skipped if a sync finished in the last 15 min. */
export const POST = withUser(async (req) => {
  const auto = new URL(req.url).searchParams.get("auto") === "1";
  return Response.json(await syncAll({ auto }));
});
