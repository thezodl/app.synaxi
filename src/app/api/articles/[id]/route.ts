import { isUuid } from "@/core/views";
import { getArticle } from "@/server/articles";
import { withUser } from "@/server/auth";

/** Full article. Extracts the page on first open when the feed only has a summary. */
export const GET = withUser(async (_req, _user, ctx: RouteContext<"/api/articles/[id]">) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) return Response.json({ error: "Not found" }, { status: 404 });
  const article = await getArticle(id);
  return article ? Response.json(article) : Response.json({ error: "Not found" }, { status: 404 });
});
