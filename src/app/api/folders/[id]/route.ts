import { withUser } from "@/server/auth";
import { deleteFolder, renameFolder } from "@/server/feeds";
import { idParam, jsonBody, str } from "@/server/validate";

type Ctx = RouteContext<"/api/folders/[id]">;

/** PATCH { name } */
export const PATCH = withUser(async (req, _user, ctx: Ctx) => {
  const id = idParam((await ctx.params).id);
  await renameFolder(id, str((await jsonBody(req)).name, "Name", 100));
  return new Response(null, { status: 204 });
});

/** DELETE → its feeds become ungrouped. */
export const DELETE = withUser(async (_req, _user, ctx: Ctx) => {
  await deleteFolder(idParam((await ctx.params).id));
  return new Response(null, { status: 204 });
});
