import "server-only";

import { isUuid } from "@/core/views";

import { UserError } from "./errors";

/** Parse a JSON object body or throw a 400. */
export async function jsonBody(req: Request): Promise<Record<string, unknown>> {
  const b = (await req.json().catch(() => null)) as unknown;
  if (!b || typeof b !== "object" || Array.isArray(b)) throw new UserError("Expected a JSON body");
  return b as Record<string, unknown>;
}

export function str(v: unknown, field: string, max = 300): string {
  if (typeof v !== "string" || !v.trim()) throw new UserError(`${field} is required`);
  const s = v.trim();
  if (s.length > max) throw new UserError(`${field} is too long`);
  return s;
}

/** `undefined` = not provided, `null` = clear, else a UUID. */
export function optionalId(v: unknown, field: string): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v === "string" && isUuid(v)) return v.toLowerCase();
  throw new UserError(`${field} is invalid`);
}

export function idParam(id: string): string {
  if (!isUuid(id)) throw new UserError("Not found", 404);
  return id.toLowerCase();
}

export function httpUrl(v: unknown): string {
  const s = str(v, "url", 2048);
  try {
    const u = new URL(s);
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
  } catch {}
  throw new UserError("That isn't a web address");
}
