import { parseView } from "@/core/views";
import { listArticles } from "@/server/articles";
import { withUser } from "@/server/auth";

/** GET /api/articles?view=all|today|bookmarks|folder:<id>|feed:<id>&cursor=…&todayStart=<ms> */
export const GET = withUser(async (req) => {
  const q = new URL(req.url).searchParams;
  const todayStart = Number(q.get("todayStart"));
  return Response.json(
    await listArticles(parseView(q.get("view")), {
      cursor: q.get("cursor"),
      todayStart: Number.isFinite(todayStart) && todayStart > 0 ? todayStart : null,
    }),
  );
});
