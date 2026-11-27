import { withUser } from "@/server/auth";
import { createFolder } from "@/server/feeds";
import { jsonBody, str } from "@/server/validate";

/** POST { name } */
export const POST = withUser(async (req) => {
  const folder = await createFolder(str((await jsonBody(req)).name, "Name", 100));
  return Response.json(folder, { status: 201 });
});
