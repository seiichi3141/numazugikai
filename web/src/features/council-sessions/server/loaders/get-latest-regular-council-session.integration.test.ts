import {
  cleanupTestBill,
  cleanupTestCouncilSession,
  createTestBill,
  createTestCouncilSession,
} from "@test-utils/utils";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: never[]) => unknown) => fn,
}));

const { getLatestRegularCouncilSession } = await import(
  "./get-latest-regular-council-session"
);

describe("getLatestRegularCouncilSession 統合テスト", () => {
  const sessionIds: string[] = [];
  const billIds: string[] = [];

  afterEach(async () => {
    for (const id of billIds) {
      await cleanupTestBill(id);
    }
    billIds.length = 0;
    for (const id of sessionIds) {
      await cleanupTestCouncilSession(id);
    }
    sessionIds.length = 0;
  });

  it("臨時会と議案のない予定会期を除外して最新の定例会を返す", async () => {
    const olderRegular = await createTestCouncilSession({
      start_date: "2031-02-01",
      end_date: "2031-02-28",
      kind: "regular",
    });
    sessionIds.push(olderRegular.id);

    const latestRegular = await createTestCouncilSession({
      start_date: "2031-06-01",
      end_date: "2031-06-30",
      kind: "regular",
    });
    sessionIds.push(latestRegular.id);
    const bill = await createTestBill({
      council_session_id: latestRegular.id,
      publish_status: "published",
    });
    billIds.push(bill.id);

    const extraordinary = await createTestCouncilSession({
      start_date: "2031-07-01",
      end_date: "2031-07-02",
      kind: "extraordinary",
    });
    sessionIds.push(extraordinary.id);
    const extraordinaryBill = await createTestBill({
      council_session_id: extraordinary.id,
      publish_status: "published",
    });
    billIds.push(extraordinaryBill.id);

    const emptyPlannedRegular = await createTestCouncilSession({
      start_date: "2031-09-01",
      end_date: "2031-09-30",
      kind: "regular",
    });
    sessionIds.push(emptyPlannedRegular.id);

    const result = await getLatestRegularCouncilSession();

    expect(result?.id).toBe(latestRegular.id);
  });
});
