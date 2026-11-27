import { expect, test } from "bun:test";
import { isUuid, parseView, viewKey } from "./views";

const ID = "0192f6a4-1c2b-7d3e-8f40-5a6b7c8d9e0f";

test("round-trips view keys and defaults to all", () => {
  for (const k of ["all", "today", "bookmarks", `folder:${ID}`, `feed:${ID}`])
    expect(viewKey(parseView(k))).toBe(k);
  expect(parseView(undefined)).toEqual({ kind: "all" });
  expect(parseView("feed:x")).toEqual({ kind: "all" });
  expect(parseView("feed:12")).toEqual({ kind: "all" });
});

test("normalises UUID case", () => {
  expect(parseView(`folder:${ID.toUpperCase()}`)).toEqual({ kind: "folder", id: ID });
});

test("isUuid", () => {
  expect(isUuid(ID)).toBe(true);
  expect(isUuid("nope")).toBe(false);
  expect(isUuid(null)).toBe(false);
});
