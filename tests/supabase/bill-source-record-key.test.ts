import {
  upsertBill,
  upsertCurrentSessionBill,
} from "../../packages/numazu-ingest/src/repositories/ingest-repository";
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

  it("開会中ページの提出者未確定議案をkeyなしのdraftとして登録する", async () => {
    const session = await createTestCouncilSession({
      slug: `current-bill-insert-${Date.now()}`,
    });
    sessionIds.push(session.id);
    const saved = await upsertCurrentSessionBill({
      councilSessionId: session.id,
      sourceRecordKey: null,
      billNumber: "議第88号",
      numberKind: "gi",
      numberValue: 88,
      name: "開会中ページのテスト議案",
      category: "contract",
      submittedOn: "2026-09-04",
      submitter: null,
      sourceUrl: "https://example.com/current-session",
      documentUrl: null,
    });
    billIds.push(saved.id);

    const { data, error } = await adminClient
      .from("bills")
      .select(
        "source_record_key, status, publish_status, submitted_date, submitter"
      )
      .eq("id", saved.id)
      .single();
    expect(error).toBeNull();
    expect(saved.created).toBe(true);
    expect(data).toEqual({
      source_record_key: null,
      status: "submitted",
      publish_status: "draft",
      submitted_date: "2026-09-04T00:00:00+00:00",
      submitter: null,
    });
  });

  it("開会中ページの再取得で確定済みの審議結果を消さない", async () => {
    const session = await createTestCouncilSession({
      slug: `current-bill-update-${Date.now()}`,
    });
    sessionIds.push(session.id);
    const sourceRecordKey = `numazu-city:${session.slug}:executive_bill:mayor:numbered:gi-89`;
    const first = await createTestBill({
      council_session_id: session.id,
      source_record_key: sourceRecordKey,
      bill_number: "議第89号",
      category: "ordinance",
      status: "passed",
      decided_on: "2026-10-08",
      source_url: "https://example.com/final-result",
      document_url: "https://example.com/old-document.pdf",
    });
    billIds.push(first.id);

    const saved = await upsertCurrentSessionBill({
      councilSessionId: session.id,
      sourceRecordKey: null,
      billNumber: "議第89号",
      numberKind: "gi",
      numberValue: 89,
      name: "公式ページで更新された件名",
      category: "contract",
      submittedOn: "2026-09-04",
      submitter: null,
      sourceUrl: "https://example.com/current-session",
      documentUrl: "https://example.com/new-document.pdf",
    });

    const { data, error } = await adminClient
      .from("bills")
      .select(
        "name, source_record_key, category, status, decided_on, source_url, document_url"
      )
      .eq("id", first.id)
      .single();
    expect(error).toBeNull();
    expect(saved).toEqual({ id: first.id, created: false });
    expect(data).toEqual({
      name: "公式ページで更新された件名",
      source_record_key: sourceRecordKey,
      category: "ordinance",
      status: "passed",
      decided_on: "2026-10-08",
      source_url: "https://example.com/final-result",
      document_url: "https://example.com/new-document.pdf",
    });
  });

  it("開会中ページの確定keyが既存identityと異なる場合は更新を拒否する", async () => {
    const session = await createTestCouncilSession({
      slug: `current-bill-identity-collision-${Date.now()}`,
    });
    sessionIds.push(session.id);
    const originalSourceRecordKey = `numazu-city:${session.slug}:member_bill:member:numbered:hatsugi-91`;
    const original = await createTestBill({
      council_session_id: session.id,
      source_record_key: originalSourceRecordKey,
      bill_number: "発議第91号",
      name: "更新前の件名",
      document_url: "https://example.com/original.pdf",
    });
    billIds.push(original.id);

    await expect(
      upsertCurrentSessionBill({
        councilSessionId: session.id,
        sourceRecordKey: `numazu-city:${session.slug}:committee_bill:committee:numbered:hatsugi-91`,
        billNumber: "発議第91号",
        numberKind: "hatsugi",
        numberValue: 91,
        name: "上書きされない件名",
        category: "opinion_paper",
        submittedOn: "2026-09-04",
        submitter: "committee",
        sourceUrl: "https://example.com/current-session",
        documentUrl: "https://example.com/replacement.pdf",
      })
    ).rejects.toThrow("議案の永続identityが一致しません");

    const { data, error } = await adminClient
      .from("bills")
      .select("name, source_record_key, document_url")
      .eq("id", original.id)
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({
      name: "更新前の件名",
      source_record_key: originalSourceRecordKey,
      document_url: "https://example.com/original.pdf",
    });
  });

  it("既存URLを保持しながら未設定の永続keyだけを補完する", async () => {
    const session = await createTestCouncilSession({
      slug: `current-bill-fill-key-${Date.now()}`,
    });
    sessionIds.push(session.id);
    const sourceRecordKey = `numazu-city:${session.slug}:member_bill:member:numbered:hatsugi-90`;
    const first = await createTestBill({
      council_session_id: session.id,
      source_record_key: null,
      bill_number: "発議第90号",
      status: "passed",
      document_url: "https://example.com/existing-document.pdf",
    });
    billIds.push(first.id);

    const saved = await upsertCurrentSessionBill({
      councilSessionId: session.id,
      sourceRecordKey,
      billNumber: "発議第90号",
      numberKind: "hatsugi",
      numberValue: 90,
      name: "永続key補完テスト議案",
      category: "other",
      submittedOn: "2026-09-04",
      submitter: "member",
      sourceUrl: "https://example.com/current-session",
      documentUrl: null,
    });

    const { data, error } = await adminClient
      .from("bills")
      .select("source_record_key, status, document_url")
      .eq("id", first.id)
      .single();
    expect(error).toBeNull();
    expect(saved).toEqual({ id: first.id, created: false });
    expect(data).toEqual({
      source_record_key: sourceRecordKey,
      status: "passed",
      document_url: "https://example.com/existing-document.pdf",
    });
  });

  it("異なる確定keyへの並行昇格では片方だけを保存して他方を拒否する", async () => {
    const session = await createTestCouncilSession({
      slug: `current-bill-concurrent-promotion-${Date.now()}`,
    });
    sessionIds.push(session.id);
    const original = await createTestBill({
      council_session_id: session.id,
      source_record_key: null,
      bill_number: "発議第92号",
      name: "identity確定前の議案",
    });
    billIds.push(original.id);
    const sourceRecordKeys = [
      `numazu-city:${session.slug}:member_bill:member:numbered:hatsugi-92`,
      `numazu-city:${session.slug}:committee_bill:committee:numbered:hatsugi-92`,
    ];

    const results = await Promise.allSettled(
      sourceRecordKeys.map((sourceRecordKey, index) =>
        upsertCurrentSessionBill({
          councilSessionId: session.id,
          sourceRecordKey,
          billNumber: "発議第92号",
          numberKind: "hatsugi",
          numberValue: 92,
          name: `並行更新${index + 1}`,
          category: "opinion_paper",
          submittedOn: "2026-09-04",
          submitter: index === 0 ? "member" : "committee",
          sourceUrl: "https://example.com/current-session",
          documentUrl: null,
        })
      )
    );

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1
    );
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(
      1
    );
    const { data, error } = await adminClient
      .from("bills")
      .select("source_record_key")
      .eq("id", original.id)
      .single();
    expect(error).toBeNull();
    expect(sourceRecordKeys).toContain(data?.source_record_key);
  });

  it("同じ確定keyへの並行昇格は両方成功する", async () => {
    const session = await createTestCouncilSession({
      slug: `current-bill-same-key-promotion-${Date.now()}`,
    });
    sessionIds.push(session.id);
    const original = await createTestBill({
      council_session_id: session.id,
      source_record_key: null,
      bill_number: "発議第93号",
      name: "identity確定前の議案",
    });
    billIds.push(original.id);
    const sourceRecordKey = `numazu-city:${session.slug}:member_bill:member:numbered:hatsugi-93`;

    const results = await Promise.allSettled(
      ["並行更新A", "並行更新B"].map((name) =>
        upsertCurrentSessionBill({
          councilSessionId: session.id,
          sourceRecordKey,
          billNumber: "発議第93号",
          numberKind: "hatsugi",
          numberValue: 93,
          name,
          category: "opinion_paper",
          submittedOn: "2026-09-04",
          submitter: "member",
          sourceUrl: "https://example.com/current-session",
          documentUrl: null,
        })
      )
    );

    expect(results.every(({ status }) => status === "fulfilled")).toBe(true);
    const { data, error } = await adminClient
      .from("bills")
      .select("name, source_record_key")
      .eq("id", original.id)
      .single();
    expect(error).toBeNull();
    expect(["並行更新A", "並行更新B"]).toContain(data?.name);
    expect(data?.source_record_key).toBe(sourceRecordKey);
  });
});
