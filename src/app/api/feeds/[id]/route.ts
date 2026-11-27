import { withUser } from "@/server/auth";
import { removeFeed, updateFeed } from "@/server/feeds";
import { idParam, jsonBody, optionalId, str } from "@/server/validate";

type Ctx = RouteContext<"/api/feeds/[id]">;

/** PATCH { title?, folderId? (null = no folder) } */
export const PATCH = withUser(async (req, _user, ctx: Ctx) => {
  const id = idParam((await ctx.params).id);
  const b = await jsonBody(req);
  await updateFeed(id, {
    title: b.title === undefined ? undefined : str(b.title, "Title"),
    folderId: optionalId(b.folderId, "Folder"),
  });
  return new Response(null, { status: 204 });
});

/** DELETE → unfollow. Bookmarked articles are kept in Bookmarks. */
export const DELETE = withUser(async (_req, _user, ctx: Ctx) => {
  return Response.json(await removeFeed(idParam((await ctx.params).id)));
});
