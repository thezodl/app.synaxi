import { withUser } from "@/server/auth";
import { refreshFeedOnOpen } from "@/server/sync";
import { idParam } from "@/server/validate";

/** POST → fetch this feed now (when it's opened). Skipped if it was fetched in the last 30s. */
export const POST = withUser(async (_req, _user, ctx: RouteContext<"/api/feeds/[id]/sync">) => {
  const r = await refreshFeedOnOpen(idParam((await ctx.params).id));
  return Response.json(r, { status: r.ok || r.error !== "Feed not found" ? 200 : 404 });
});
