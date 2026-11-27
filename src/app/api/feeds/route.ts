import { withUser } from "@/server/auth";
import { addFeed } from "@/server/feeds";
import { syncFeed } from "@/server/sync";
import { httpUrl, jsonBody, optionalId, str } from "@/server/validate";

/** POST { url, title, siteUrl?, folderId? } → follow it and fetch it right away. */
export const POST = withUser(async (req) => {
  const b = await jsonBody(req);
  const id = await addFeed({
    url: httpUrl(b.url),
    title: str(b.title, "Title"),
    siteUrl: typeof b.siteUrl === "string" && /^https?:\/\//i.test(b.siteUrl) ? b.siteUrl : null,
    folderId: optionalId(b.folderId, "Folder") ?? null,
  });
  const sync = await syncFeed(id);
  return Response.json({ id, sync }, { status: 201 });
});
