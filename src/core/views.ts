/** A list the user can browse. Encoded in the URL as ?view=... (ids are UUIDs). */
export type View =
  | { kind: "all" }
  | { kind: "today" }
  | { kind: "bookmarks" }
  | { kind: "folder"; id: string }
  | { kind: "feed"; id: string };

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const KEYED = new RegExp(`^(folder|feed):(${UUID})$`, "i");

export function isUuid(s: string | null | undefined): s is string {
  return !!s && new RegExp(`^${UUID}$`, "i").test(s);
}

export function parseView(s: string | null | undefined): View {
  if (s === "today" || s === "bookmarks") return { kind: s };
  const m = KEYED.exec(s ?? "");
  if (m) return { kind: m[1]!.toLowerCase() as "folder" | "feed", id: m[2]!.toLowerCase() };
  return { kind: "all" };
}

export function viewKey(v: View): string {
  return v.kind === "folder" || v.kind === "feed" ? `${v.kind}:${v.id}` : v.kind;
}

/**
 * Start of "today" in the *viewer's* time zone. The server has no idea where the user is, so
 * the client computes this and sends it with Today queries.
 */
export function startOfLocalDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
