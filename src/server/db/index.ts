import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let instance: Db | null = null;

/** Lazily created so `next build` doesn't need DATABASE_URL. HTTP driver: one round trip per query. */
export function db(): Db {
  if (!instance) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL must be set");
    instance = drizzle({ client: neon(url), schema });
  }
  return instance;
}

export { schema };
