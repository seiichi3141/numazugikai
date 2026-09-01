import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cachedLoader } from "./load-og-assets";

describe("cachedLoader", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("成功した値は以後の呼び出しで使い回し、読み込みは1回だけ", async () => {
    const load = vi.fn().mockResolvedValue("font");
    const get = cachedLoader(load);

    expect(await get()).toBe("font");
    expect(await get()).toBe("font");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("同時に呼ばれても読み込みは1回にまとめる", async () => {
    // 同じ議案が複数の SNS から同時に取られたときに、全員が取りに行かない
    let resolve: (v: string) => void = () => {};
    const load = vi.fn(
      () =>
        new Promise<string>((r) => {
          resolve = r;
        })
    );
    const get = cachedLoader(load);

    const a = get();
    const b = get();
    resolve("font");

    expect(await a).toBe("font");
    expect(await b).toBe("font");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("失敗したあと一定時間は再試行せず null を返す", async () => {
    // 障害中に毎回タイムアウトを待たない
    const load = vi.fn().mockResolvedValue(null);
    const get = cachedLoader(load);

    expect(await get()).toBeNull();
    expect(await get()).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("一定時間が過ぎたら再試行する", async () => {
    const load = vi.fn().mockResolvedValueOnce(null).mockResolvedValue("font");
    const get = cachedLoader(load);

    expect(await get()).toBeNull();
    vi.advanceTimersByTime(60_000);
    expect(await get()).toBe("font");
    expect(load).toHaveBeenCalledTimes(2);
  });
});
