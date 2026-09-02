import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "./map-with-concurrency";

describe("mapWithConcurrency", () => {
  it("結果を元の順番で返す", async () => {
    const result = await mapWithConcurrency([3, 1, 2], 2, async (n) => {
      await new Promise((resolve) => setTimeout(resolve, n * 5));
      return n * 10;
    });
    expect(result).toEqual([30, 10, 20]);
  });

  it("同時に走る処理を concurrency 件までに抑える", async () => {
    let running = 0;
    let peak = 0;
    await mapWithConcurrency([1, 2, 3, 4, 5], 2, async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
    });
    expect(peak).toBe(2);
  });

  it("空配列でも落ちない", async () => {
    expect(await mapWithConcurrency([], 3, async (n: number) => n)).toEqual([]);
  });
});
