import { withUser } from "@/server/auth";
import { listTree } from "@/server/feeds";
import { getSyncState } from "@/server/sync";

/** Sidebar data: folders, followed feeds (no URLs) and the last sync summary. */
export const GET = withUser(async () => {
  const [tree, sync] = await Promise.all([listTree(), getSyncState()]);
  return Response.json({ ...tree, sync });
});
