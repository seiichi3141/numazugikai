import { describe, expect, it } from "vitest";
import {
  cleanupTestUser,
  createTestUser,
  getAnonClient,
  getAuthenticatedClient,
} from "../utils";

/**
 * 全テーブルは RLS 有効 + ポリシーなし（default deny）。
 * anon / authenticated どちらからも SELECT・INSERT できないことを確認する。
 */

const tables = [
  "bills",
  "bill_contents",
  "mirai_stances",
  "chats",
  "tags",
  "bills_tags",
  "preview_tokens",
  "council_sessions",
  "interview_configs",
  "interview_questions",
  "interview_sessions",
  "interview_messages",
  "interview_report",
] as const;

describe("RLS default deny（全テーブル共通）", () => {
  describe("anon クライアント", () => {
    const anon = getAnonClient();

    for (const table of tables) {
      it(`${table}: SELECT が空結果になる`, async () => {
        const { data, error } = await anon.from(table).select("*").limit(1);
        // RLS で拒否される場合、エラーか空配列が返る
        if (error) {
          expect(error).toBeTruthy();
        } else {
          expect(data).toEqual([]);
        }
      });
    }

    it("bills: INSERT が拒否される", async () => {
      const { error } = await anon.from("bills").insert({
        name: "不正な挿入テスト",
        status: "submitted",
        publish_status: "draft",
      });
      expect(error).not.toBeNull();
    });

    it("council_sessions: INSERT が拒否される", async () => {
      const { error } = await anon.from("council_sessions").insert({
        name: "不正な挿入テスト",
        start_date: "2025-01-01",
        end_date: "2025-06-30",
        slug: "rls-test",
      });
      expect(error).not.toBeNull();
    });
  });

  describe("authenticated クライアント", () => {
    let userId: string;
    let email: string;
    const password = "test-password-123";

    beforeAll(async () => {
      email = `rls-test-${Date.now()}@example.com`;
      const user = await createTestUser(email, password);
      userId = user.id;
    });

    afterAll(async () => {
      await cleanupTestUser(userId);
    });

    for (const table of tables) {
      it(`${table}: SELECT が空結果になる`, async () => {
        const client = await getAuthenticatedClient(email, password);
        const { data, error } = await client.from(table).select("*").limit(1);
        if (error) {
          expect(error).toBeTruthy();
        } else {
          expect(data).toEqual([]);
        }
      });
    }

    it("bills: INSERT が拒否される", async () => {
      const client = await getAuthenticatedClient(email, password);
      const { error } = await client.from("bills").insert({
        name: "不正な挿入テスト",
        status: "submitted",
        publish_status: "draft",
      });
      expect(error).not.toBeNull();
    });

    it("council_sessions: INSERT が拒否される", async () => {
      const client = await getAuthenticatedClient(email, password);
      const { error } = await client.from("council_sessions").insert({
        name: "不正な挿入テスト",
        start_date: "2025-01-01",
        end_date: "2025-06-30",
        slug: "rls-test",
      });
      expect(error).not.toBeNull();
    });
  });
});
