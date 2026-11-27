import { expect, test } from "bun:test";

import { DEFAULT_TYPOGRAPHY, parseTypography } from "./typography";

test("fills defaults and rejects junk", () => {
  expect(parseTypography(null)).toEqual(DEFAULT_TYPOGRAPHY);
  expect(parseTypography({ font: "comic", size: "big", lineHeight: 3 })).toEqual(
    DEFAULT_TYPOGRAPHY,
  );
});

test("clamps and rounds numbers", () => {
  expect(parseTypography({ size: 99, width: 10.4 })).toMatchObject({ size: 26, width: 50 });
  expect(parseTypography({ size: 16.6 })).toMatchObject({ size: 17 });
});

test("keeps valid values", () => {
  const t = { font: "sans", size: 20, lineHeight: "relaxed", width: 80 } as const;
  expect(parseTypography(t)).toEqual(t);
});
