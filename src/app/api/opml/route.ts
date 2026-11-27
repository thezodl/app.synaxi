import { buildOpml, parseOpml } from "@/core/opml";
import { withUser } from "@/server/auth";
import { importFeeds, listForExport } from "@/server/feeds";

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

/**
 * GET → OPML export. This is the one response that contains feed URLs (that's its purpose), so
 * it's never cached.
 */
export const GET = withUser(async () => {
  const { folders, feeds } = await listForExport();
  const date = new Date().toISOString().slice(0, 10);
  return new Response(buildOpml(feeds, folders), {
    headers: {
      "content-type": "text/x-opml; charset=utf-8",
      "content-disposition": `attachment; filename="synaxi-${date}.opml"`,
      "cache-control": "no-store",
    },
  });
});
