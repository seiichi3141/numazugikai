import { describe, expect, it } from "vitest";
import type { Bill } from "../types";
import { BILL_STATUS_ORDER } from "../types";
import {
  prepareBillContentsForDuplication,
  prepareBillForDuplication,
} from "./prepare-bill-for-duplication";

const baseBill: Bill = {
  id: "bill-001",
  name: "テスト議案",
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-02T00:00:00Z",
  council_session_id: "session-001",
  bill_number: "議第58号",
  bill_number_kind: "gi",
  bill_number_value: 58,
  category: "ordinance",
  submitter: "mayor",
  committee_id: null,
  committee_result: null,
  decided_on: null,
  legal_basis: null,
  explanation_source: null,
  committee_qa_count: null,
  committee_minutes_url: null,
  document_url: null,
  is_featured: true,
  is_review_completed: true,
  publish_status: "published",
  published_at: null,
  submitted_date: null,
  share_thumbnail_url: null,
  source_url: null,
  slug: null,
  status: "submitted",
  status_note: null,
  status_order: BILL_STATUS_ORDER.submitted,
  publish_status_order: 2,
  thumbnail_url: null,
  knowledge_source: null,
  use_knowledge_source_in_chat: false,
};

describe("prepareBillForDuplication", () => {
  it("id, created_at, updated_atを除去する", () => {
    const result = prepareBillForDuplication(baseBill);
    expect(result).not.toHaveProperty("id");
    expect(result).not.toHaveProperty("created_at");
    expect(result).not.toHaveProperty("updated_at");
  });

  it("名前に「(複製)」を付与する", () => {
    const result = prepareBillForDuplication(baseBill);
    expect(result.name).toBe("テスト議案 (複製)");
  });

  it("publish_statusをdraftに設定する", () => {
    const result = prepareBillForDuplication(baseBill);
    expect(result.publish_status).toBe("draft");
  });

  it("is_review_completedをfalseにリセットする", () => {
    const result = prepareBillForDuplication(baseBill);
    expect(result.is_review_completed).toBe(false);
  });

  it("slugをnullにリセットする", () => {
    const billWithSlug = { ...baseBill, slug: "test-slug" };
    const result = prepareBillForDuplication(billWithSlug);
    expect(result.slug).toBeNull();
  });

  it("その他のフィールドを保持する", () => {
    const result = prepareBillForDuplication(baseBill);
    expect(result.council_session_id).toBe("session-001");
    expect(result.is_featured).toBe(true);
    expect(result.bill_number).toBe("議第58号");
  });
});

describe("prepareBillContentsForDuplication", () => {
  const contents = [
    {
      id: "content-001",
      bill_id: "bill-001",
      title: "概要",
      content: "内容1",
      summary: "要約1",
      difficulty_level: "easy" as const,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "content-002",
      bill_id: "bill-001",
      title: "詳細",
      content: "内容2",
      summary: "要約2",
      difficulty_level: "normal" as const,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
  ];

  it("id, bill_idを除去し新しいbill_idを設定する", () => {
    const result = prepareBillContentsForDuplication(contents, "new-bill-id");
    for (const item of result) {
      expect(item).not.toHaveProperty("id");
      expect(item.bill_id).toBe("new-bill-id");
    }
  });

  it("元のコンテンツデータを保持する", () => {
    const result = prepareBillContentsForDuplication(contents, "new-bill-id");
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("概要");
    expect(result[0].content).toBe("内容1");
    expect(result[1].title).toBe("詳細");
    expect(result[1].content).toBe("内容2");
  });

  it("空配列を渡すと空配列を返す", () => {
    const result = prepareBillContentsForDuplication([], "new-bill-id");
    expect(result).toEqual([]);
  });
});
