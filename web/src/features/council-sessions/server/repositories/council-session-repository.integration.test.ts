import {
  cleanupTestCouncilSession,
  createTestCouncilSession,
} from "@test-utils/utils";
import { afterEach, describe, expect, it } from "vitest";
import {
  findActiveCouncilSession,
  findCouncilSessionBySlug,
  findCurrentCouncilSession,
  findPreviousCouncilSession,
} from "./council-session-repository";

describe("council-session-repository 統合テスト", () => {
  const sessionIds: string[] = [];

  afterEach(async () => {
    for (const id of sessionIds) {
      await cleanupTestCouncilSession(id);
    }
    sessionIds.length = 0;
  });

  describe("findActiveCouncilSession", () => {
    it("is_active=true の会期を返す", async () => {
      const session = await createTestCouncilSession({ is_active: true });
      sessionIds.push(session.id);

      const result = await findActiveCouncilSession();

      expect(result).not.toBeNull();
      expect(result?.is_active).toBe(true);
    });
  });

  describe("findCurrentCouncilSession", () => {
    it("指定日が範囲内の会期を返す", async () => {
      const session = await createTestCouncilSession({
        start_date: "2028-04-01",
        end_date: "2028-09-30",
        is_active: false,
      });
      sessionIds.push(session.id);

      const result = await findCurrentCouncilSession("2028-06-15");

      expect(result).not.toBeNull();
      expect(result?.id).toBe(session.id);
    });

    it("開始日ちょうどの日付で会期を返す", async () => {
      const session = await createTestCouncilSession({
        start_date: "2028-04-01",
        end_date: "2028-09-30",
        is_active: false,
      });
      sessionIds.push(session.id);

      const result = await findCurrentCouncilSession("2028-04-01");

      expect(result).not.toBeNull();
      expect(result?.id).toBe(session.id);
    });

    it("終了日ちょうどの日付で会期を返す", async () => {
      const session = await createTestCouncilSession({
        start_date: "2028-04-01",
        end_date: "2028-09-30",
        is_active: false,
      });
      sessionIds.push(session.id);

      const result = await findCurrentCouncilSession("2028-09-30");

      expect(result).not.toBeNull();
      expect(result?.id).toBe(session.id);
    });

    it("範囲外の日付では該当会期を返さない", async () => {
      const session = await createTestCouncilSession({
        start_date: "2032-04-01",
        end_date: "2032-09-30",
        is_active: false,
      });
      sessionIds.push(session.id);

      const result = await findCurrentCouncilSession("2032-10-01");

      if (result) {
        expect(result.id).not.toBe(session.id);
      } else {
        expect(result).toBeNull();
      }
    });
  });

  describe("findCouncilSessionBySlug", () => {
    it("slug で会期を取得できる", async () => {
      const slug = `test-repo-slug-${Date.now()}`;
      const session = await createTestCouncilSession({ slug });
      sessionIds.push(session.id);

      const result = await findCouncilSessionBySlug(slug);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(session.id);
      expect(result?.slug).toBe(slug);
    });

    it("存在しない slug では null を返す", async () => {
      const result = await findCouncilSessionBySlug(
        "non-existent-slug-999999999"
      );

      expect(result).toBeNull();
    });
  });

  describe("findPreviousCouncilSession", () => {
    it("指定日より前の直近の会期を返す", async () => {
      const session = await createTestCouncilSession({
        start_date: "2027-01-01",
        end_date: "2027-06-30",
        is_active: false,
      });
      sessionIds.push(session.id);

      const result = await findPreviousCouncilSession("2028-01-01");

      expect(result).not.toBeNull();
      // biome-ignore lint/style/noNonNullAssertion: toBeNull 後に安全
      expect(new Date(result!.start_date) < new Date("2028-01-01")).toBe(true);
    });

    it("指定日より前の会期がない場合は null を返す", async () => {
      const result = await findPreviousCouncilSession("1900-01-01");

      expect(result).toBeNull();
    });
  });
});
