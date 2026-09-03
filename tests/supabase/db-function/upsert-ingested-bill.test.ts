import {
  type BillUpsert,
  upsertBill,
} from "../../../packages/numazu-ingest/src/repositories/ingest-repository";
import {
  adminClient,
  cleanupTestBill,
  cleanupTestCouncilSession,
  cleanupTestUser,
  createTestBill,
  createTestCouncilSession,
  createTestUser,
  getAnonClient,
  getAuthenticatedClient,
} from "../utils";

const rpcInput = {
  p_bill_number: "議第1号",
  p_category: "other",
  p_council_session_id: "00000000-0000-0000-0000-000000000001",
  p_name: "権限テスト議案",
  p_number_kind: "gi",
  p_number_value: 1,
  p_source_url: "https://www.city.numazu.shizuoka.jp/",
  p_status: "submitted",
} as const;

function buildBillInput(
  councilSessionId: string,
  sourceRecordKey: string | null,
  billNumber: string
): BillUpsert {
  return {
    councilSessionId,
    sourceRecordKey,
    billNumber,
    numberKind: "gi",
    numberValue: 100,
    name: "原子的upsertテスト議案",
    category: "other",
    legalBasis: null,
    submittedOn: null,
    submitter: "mayor",
    committeeId: null,
    committeeResult: null,
    decidedOn: null,
    status: "submitted",
    statusNote: null,
    sourceUrl:
      "https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/annai/houkoku/teirei_25.htm",
    documentUrl: null,
  };
}

describe("upsert_ingested_bill", () => {
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

  it("匿名利用者には実行を許可しない", async () => {
    const { error } = await getAnonClient().rpc(
      "upsert_ingested_bill",
      rpcInput
    );

    expect(error?.code).toBe("42501");
    expect(error?.message).toContain("upsert_ingested_bill");
  });

  it("認証済み一般利用者にも実行を許可しない", async () => {
    const user = await createTestUser();
    try {
      const client = await getAuthenticatedClient(user.email, user.password);
      const { error } = await client.rpc("upsert_ingested_bill", rpcInput);

      expect(error?.code).toBe("42501");
      expect(error?.message).toContain("upsert_ingested_bill");
    } finally {
      await cleanupTestUser(user.id);
    }
  });

  it("source key衝突時は新しい議案行も部分更新も残さない", async () => {
    const session = await createTestCouncilSession({
      slug: `atomic-ingest-${Date.now()}`,
    });
    sessionIds.push(session.id);
    const sourceRecordKey = `numazu-city:${session.slug}:executive_bill:mayor:numbered:gi-100`;
    const original = await createTestBill({
      council_session_id: session.id,
      bill_number: "議第100号",
      name: "衝突元の議案",
      source_record_key: sourceRecordKey,
    });
    billIds.push(original.id);

    await expect(
      upsertBill(buildBillInput(session.id, sourceRecordKey, "議案第100号"))
    ).rejects.toThrow("bills_source_record_key_key");

    const { data, error } = await adminClient
      .from("bills")
      .select("id, bill_number, name, source_record_key")
      .eq("council_session_id", session.id);

    expect(error).toBeNull();
    expect(data).toEqual([
      {
        id: original.id,
        bill_number: "議第100号",
        name: "衝突元の議案",
        source_record_key: sourceRecordKey,
      },
    ]);
  });

  it("legacy行のnull keyを初回の永続keyへ昇格する", async () => {
    const session = await createTestCouncilSession({
      slug: `legacy-key-upgrade-${Date.now()}`,
    });
    sessionIds.push(session.id);
    const sourceRecordKey = `numazu-city:${session.slug}:executive_bill:mayor:numbered:gi-100`;
    const original = await createTestBill({
      council_session_id: session.id,
      bill_number: "議第100号",
      name: "identity確定前の議案",
      source_record_key: null,
    });
    billIds.push(original.id);

    const updatedId = await upsertBill(
      buildBillInput(session.id, sourceRecordKey, "議第100号")
    );

    expect(updatedId).toBe(original.id);
    const { data, error } = await adminClient
      .from("bills")
      .select("id, name, source_record_key")
      .eq("id", original.id)
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({
      id: original.id,
      name: "原子的upsertテスト議案",
      source_record_key: sourceRecordKey,
    });
  });

  it("legacy結果PDFのkeyなし再取り込みは完全な内容を更新して既存keyを保持する", async () => {
    const session = await createTestCouncilSession({
      slug: `identified-key-retention-${Date.now()}`,
    });
    sessionIds.push(session.id);
    const sourceRecordKey = `numazu-city:${session.slug}:executive_bill:mayor:numbered:gi-100`;
    const original = await createTestBill({
      council_session_id: session.id,
      bill_number: "議第100号",
      name: "更新前の議案",
      source_record_key: sourceRecordKey,
    });
    billIds.push(original.id);

    const updatedId = await upsertBill(
      buildBillInput(session.id, null, "議第100号")
    );

    expect(updatedId).toBe(original.id);
    const { data, error } = await adminClient
      .from("bills")
      .select("id, name, source_record_key")
      .eq("id", original.id)
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({
      id: original.id,
      name: "原子的upsertテスト議案",
      source_record_key: sourceRecordKey,
    });
  });

  it("同じ会期・議案番号の別identityは行全体を更新せず拒否する", async () => {
    const session = await createTestCouncilSession({
      slug: `identity-collision-${Date.now()}`,
    });
    sessionIds.push(session.id);
    const originalSourceRecordKey = `numazu-city:${session.slug}:executive_bill:mayor:numbered:gi-100`;
    const incomingSourceRecordKey = `numazu-city:${session.slug}:committee_bill:committee:numbered:gi-100`;
    const original = await createTestBill({
      council_session_id: session.id,
      bill_number: "議第100号",
      name: "知事提出の議案",
      bill_number_kind: "gi",
      bill_number_value: 100,
      submitter: "mayor",
      source_record_key: originalSourceRecordKey,
    });
    billIds.push(original.id);

    let rejection: unknown;
    try {
      await upsertBill(
        buildBillInput(session.id, incomingSourceRecordKey, "議第100号")
      );
    } catch (error) {
      rejection = error;
    }
    expect(rejection).toBeInstanceOf(Error);
    expect((rejection as Error).message).toContain(
      "source_record_key mismatch"
    );
    expect((rejection as Error).message).toContain(`bill_number='議第100号'`);
    expect((rejection as Error).message).toContain("ingest_identity_collision");

    const { data, error } = await adminClient
      .from("bills")
      .select("*")
      .eq("council_session_id", session.id);
    expect(error).toBeNull();
    expect(data).toEqual([original]);
  });

  it("legacy行のkey昇格が別行のkeyと衝突しても両行を更新しない", async () => {
    const session = await createTestCouncilSession({
      slug: `legacy-key-collision-${Date.now()}`,
    });
    sessionIds.push(session.id);
    const sourceRecordKey = `numazu-city:${session.slug}:executive_bill:mayor:numbered:gi-101`;
    const legacy = await createTestBill({
      council_session_id: session.id,
      bill_number: "議第100号",
      name: "identity確定前の議案",
      source_record_key: null,
    });
    const identified = await createTestBill({
      council_session_id: session.id,
      bill_number: "議第101号",
      name: "identity確定済みの議案",
      source_record_key: sourceRecordKey,
    });
    billIds.push(legacy.id, identified.id);

    await expect(
      upsertBill(buildBillInput(session.id, sourceRecordKey, "議第100号"))
    ).rejects.toThrow("bills_source_record_key_key");

    const { data, error } = await adminClient
      .from("bills")
      .select("*")
      .eq("council_session_id", session.id)
      .order("bill_number");
    expect(error).toBeNull();
    expect(data).toEqual([legacy, identified]);
  });
});
