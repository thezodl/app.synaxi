import { expect, test } from "bun:test";
import { mapPool } from "./pool";

test("limits concurrency and preserves order", async () => {
  let inFlight = 0;
  let peak = 0;
  const out = await mapPool([5, 1, 4, 2, 3], 2, async (n) => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, n));
    inFlight--;
    return n * 10;
  });
  expect(out).toEqual([50, 10, 40, 20, 30]);
  expect(peak).toBe(2);
});
