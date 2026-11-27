import { after } from "next/server";

import { isUuid } from "@/core/views";
import { ensureExtracted, setBookmarked } from "@/server/articles";
import { withUser } from "@/server/auth";

type Ctx = RouteContext<"/api/articles/[id]/bookmark">;

/** PUT: bookmark. Body `{ restoreAt?: ms }` restores the original time (Undo). */
export const PUT = withUser(async (req, _user, ctx: Ctx) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) return Response.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { restoreAt?: unknown };
  const restoreAt =
    typeof body.restoreAt === "number" && body.restoreAt > 0 && body.restoreAt <= Date.now()
      ? body.restoreAt
      : undefined;
  const r = await setBookmarked(id, true, restoreAt);
  if (!r) return Response.json({ error: "Not found" }, { status: 404 });
  // Pre-extract so the bookmark opens instantly later.
  after(() => ensureExtracted(id).catch(() => undefined));
  return Response.json(r);
});

/** DELETE: clear the bookmark (manual, or auto-clear at the end of the article). */
export const DELETE = withUser(async (_req, _user, ctx: Ctx) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) return Response.json({ error: "Not found" }, { status: 404 });
  const r = await setBookmarked(id, false);
  return r ? Response.json(r) : Response.json({ error: "Not found" }, { status: 404 });
});
