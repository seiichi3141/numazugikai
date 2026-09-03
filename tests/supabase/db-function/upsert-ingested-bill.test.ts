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
  sourceRecordKey: string,
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
});
