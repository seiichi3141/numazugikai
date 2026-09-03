import { upsertBill } from "../../packages/numazu-ingest/src/repositories/ingest-repository";
import {
  adminClient,
  cleanupTestBill,
  cleanupTestCouncilSession,
  createTestBill,
  createTestCouncilSession,
} from "./utils";

describe("bills.source_record_key", () => {
  const billIds: string[] = [];
  const sessionIds: string[] = [];

  afterEach(async () => {
    for (const billId of billIds.splice(0)) {
      await cleanupTestBill(billId);
    }
    for (const sessionId of sessionIds.splice(0)) {
      await cleanupTestCouncilSession(sessionId);
    }
  });

  it("未移行・手入力recordではnullを複数許容する", async () => {
    const first = await createTestBill({ source_record_key: null });
    const second = await createTestBill({ source_record_key: null });
    billIds.push(first.id, second.id);

    expect(first.source_record_key).toBeNull();
    expect(second.source_record_key).toBeNull();
  });

  it("非nullのsource record keyは重複を拒否する", async () => {
    const sourceRecordKey = `numazu-city:test-${Date.now()}:report:mayor:numbered:hou-1`;
    const first = await createTestBill({ source_record_key: sourceRecordKey });
    billIds.push(first.id);

    const { error } = await adminClient.from("bills").insert({
      name: "重複するテスト議案",
      source_record_key: sourceRecordKey,
    });

    expect(error?.code).toBe("23505");
    expect(error?.message).toContain("bills_source_record_key_key");
  });

  it("source record key指定のupsertを冪等に更新する", async () => {
    const session = await createTestCouncilSession({
      slug: `source-key-upsert-${Date.now()}`,
    });
    sessionIds.push(session.id);
    const sourceRecordKey = `numazu-city:${session.slug}:executive_bill:mayor:numbered:gi-1`;
    const first = await createTestBill({
      council_session_id: session.id,
      bill_number: "議第1号",
      source_record_key: sourceRecordKey,
    });
    billIds.push(first.id);

    const { data, error } = await adminClient
      .from("bills")
      .upsert(
        {
          council_session_id: session.id,
          bill_number: "議第1号",
          name: "更新後のテスト議案",
          source_record_key: sourceRecordKey,
        },
        { onConflict: "source_record_key" }
      )
      .select("id, name")
      .single();

    expect(error).toBeNull();
    expect(data).toEqual({ id: first.id, name: "更新後のテスト議案" });
    const { count } = await adminClient
      .from("bills")
      .select("id", { count: "exact", head: true })
      .eq("source_record_key", sourceRecordKey);
    expect(count).toBe(1);
  });

  it("Numazu writerは旧競合keyを維持しながらsource record keyを併記する", async () => {
    const session = await createTestCouncilSession({
      slug: `numazu-writer-${Date.now()}`,
    });
    sessionIds.push(session.id);
    const sourceRecordKey = `numazu-city:${session.slug}:executive_bill:mayor:numbered:gi-1`;
    const input = {
      councilSessionId: session.id,
      sourceRecordKey,
      billNumber: "議第1号",
      numberKind: "gi" as const,
      numberValue: 1,
      name: "Numazu writerテスト議案",
      category: "ordinance" as const,
      legalBasis: null,
      submittedOn: "2026-01-01",
      submitter: "mayor" as const,
      committeeId: null,
      committeeResult: null,
      decidedOn: "2026-01-02",
      status: "passed" as const,
      statusNote: null,
      sourceUrl:
        "https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/annai/houkoku/teirei_25.htm",
      documentUrl: null,
    };

    const firstId = await upsertBill(input);
    billIds.push(firstId);
    const secondId = await upsertBill({ ...input, name: "更新後の議案名" });

    expect(secondId).toBe(firstId);
    const { data, error } = await adminClient
      .from("bills")
      .select("name, source_record_key")
      .eq("id", firstId)
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({
      name: "更新後の議案名",
      source_record_key: sourceRecordKey,
    });
  });

  it("提出者を一時的に解釈できなくても既存の永続keyを消さない", async () => {
    const session = await createTestCouncilSession({
      slug: `numazu-key-retention-${Date.now()}`,
    });
    sessionIds.push(session.id);
    const sourceRecordKey = `numazu-city:${session.slug}:executive_bill:mayor:numbered:gi-1`;
    const first = await createTestBill({
      council_session_id: session.id,
      bill_number: "議第1号",
      source_record_key: sourceRecordKey,
    });
    billIds.push(first.id);

    const updatedId = await upsertBill({
      councilSessionId: session.id,
      sourceRecordKey: null,
      billNumber: "議第1号",
      numberKind: "gi",
      numberValue: 1,
      name: "提出者未解釈の再取り込み",
      category: "other",
      legalBasis: null,
      submittedOn: null,
      submitter: null,
      committeeId: null,
      committeeResult: null,
      decidedOn: null,
      status: "submitted",
      statusNote: null,
      sourceUrl:
        "https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/annai/houkoku/teirei_25.htm",
      documentUrl: null,
    });

    expect(updatedId).toBe(first.id);
    const { data } = await adminClient
      .from("bills")
      .select("source_record_key")
      .eq("id", first.id)
      .single();
    expect(data?.source_record_key).toBe(sourceRecordKey);
  });

  it("移行中は既存の会期・議案番号一意制約も維持する", async () => {
    const session = await createTestCouncilSession({
      slug: `legacy-key-${Date.now()}`,
    });
    sessionIds.push(session.id);
    const first = await createTestBill({
      council_session_id: session.id,
      bill_number: "議第1号",
      source_record_key: `numazu-city:${session.slug}:executive_bill:mayor:numbered:gi-1`,
    });
    billIds.push(first.id);

    const { error } = await adminClient.from("bills").insert({
      council_session_id: session.id,
      bill_number: "議第1号",
      name: "旧制約と重複する議案",
      source_record_key: `numazu-city:${session.slug}:member_bill:member:numbered:hatsugi-1`,
    });

    expect(error?.code).toBe("23505");
    expect(error?.message).toContain("bills_session_bill_number_key");
  });
});
