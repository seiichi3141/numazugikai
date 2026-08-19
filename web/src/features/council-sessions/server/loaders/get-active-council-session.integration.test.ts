import {
  cleanupTestCouncilSession,
  createTestCouncilSession,
} from "@test-utils/utils";
import { afterEach, describe, expect, it, vi } from "vitest";

// unstable_cache はモジュール初期化時に評価されるため、
// setup の共通モック（vitest.integration.setup.ts）だけでは不十分。
// テストファイル内で vi.mock → 動的インポートの順序を保証する必要がある。
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: never[]) => unknown) => fn,
}));
const { getActiveCouncilSession } = await import(
  "./get-active-council-session"
);

describe("getActiveCouncilSession 統合テスト", () => {
  const sessionIds: string[] = [];

  afterEach(async () => {
    for (const id of sessionIds) {
      await cleanupTestCouncilSession(id);
    }
    sessionIds.length = 0;
  });

  it("アクティブな会期を返す", async () => {
    const session = await createTestCouncilSession({ is_active: true });
    sessionIds.push(session.id);

    const result = await getActiveCouncilSession();

    expect(result).not.toBeNull();
    expect(result?.is_active).toBe(true);
  });
});
