import { withUser } from "@/server/auth";
import { findFeeds } from "@/server/discover";
import { isFollowed } from "@/server/feeds";
import { jsonBody, str } from "@/server/validate";

/**
 * POST { input } → the feed(s) at what the user typed (a feed URL or a web page).
 * Returns discovered URLs: they're the user's own input (or public links on that page), and the
 * client sends the chosen one back to POST /api/feeds.
 */
export const POST = withUser(async (req) => {
  const r = await findFeeds(str((await jsonBody(req)).input, "Address", 2048));
  const list = r.kind === "feed" ? [r.feed] : r.feeds;
  const feeds = await Promise.all(
    list.map(async (f) => ({ ...f, followed: await isFollowed(f.url) })),
  );
  return Response.json({ feeds });
});
