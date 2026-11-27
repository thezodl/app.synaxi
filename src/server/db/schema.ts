import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";

/**
 * Shared columns. Every table has a UUIDv7 id (generated in the app, so a future mobile client can
 * create rows offline) and an updated_at that later delta sync can pull from.
 */
export const id = () =>
  uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7());

export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** Key/value settings (typography, sync state). Phase 1 adds folders, feeds, articles. */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  ...timestamps,
});
