import { parseOpml } from "@/core/opml";
import { withUser } from "@/server/auth";
import { importFeeds } from "@/server/feeds";

const MAX_BYTES = 2 * 1024 * 1024;

/** POST /api/opml with the OPML file as the raw body. */
export const POST = withUser(async (req) => {
  const xml = await req.text();
  if (xml.length > MAX_BYTES) return Response.json({ error: "File too large" }, { status: 413 });
  let list;
  try {
    list = parseOpml(xml);
  } catch {
    return Response.json({ error: "That isn't an OPML file" }, { status: 400 });
  }
  const r = await importFeeds(list);
  return Response.json({ ...r, total: list.length });
});
