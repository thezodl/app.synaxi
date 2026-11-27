import "server-only";

import { eq } from "drizzle-orm";

import { parseTypography, type Typography } from "@/core/typography";

import { db } from "./db";
import { settings } from "./db/schema";

export async function getTypography(): Promise<Typography> {
  const [row] = await db().select().from(settings).where(eq(settings.key, "typography"));
  return parseTypography(row?.value);
}

export async function setTypography(input: unknown): Promise<Typography> {
  const value = parseTypography(input);
  await db()
    .insert(settings)
    .values({ key: "typography", value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
  return value;
}
