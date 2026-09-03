import {
  type FetchedText,
  NumazuSiteClient,
} from "../fetchers/numazu-site-client";
import { buildSessionName, buildSessionSlug } from "../parsers/map-bill-status";
import { parseCurrentSessionBillsHtml } from "../parsers/parse-current-session-bills";
import {
  ensureCouncilSession,
  findContentHash,
  findCouncilSessionBySlug,
  saveContentHash,
  upsertCurrentSessionBill,
} from "../repositories/ingest-repository";
import { NUMAZU_SITE_URLS } from "../shared/constants-site";
import { buildNumazuBillSourceRecordKey } from "../utils/build-numazu-bill-source-record-key";

const SOURCE = "bill_documents";

export interface CurrentSessionBillsClient {
  fetchHtml(url: string): Promise<FetchedText>;
}

export type CurrentSessionBillsDependencies = {
  findContentHash: typeof findContentHash;
  findCouncilSessionBySlug: typeof findCouncilSessionBySlug;
  ensureCouncilSession: typeof ensureCouncilSession;
  saveContentHash: typeof saveContentHash;
  upsertCurrentSessionBill: typeof upsertCurrentSessionBill;
};

const defaultDependencies: CurrentSessionBillsDependencies = {
  findContentHash,
  findCouncilSessionBySlug,
  ensureCouncilSession,
  saveContentHash,
  upsertCurrentSessionBill,
};

export type IngestCurrentSessionBillsResult = {
  skipped: boolean;
  sessionSlug: string | null;
  billCount: number;
  createdCount: number;
  updatedCount: number;
};

/** 開会中の「本会議のお知らせ」から提出議案と本文PDFリンクを取り込む。 */
export async function ingestCurrentSessionBills(
  options: {
    force?: boolean;
    client?: CurrentSessionBillsClient;
    dependencies?: CurrentSessionBillsDependencies;
    today?: string;
  } = {}
): Promise<IngestCurrentSessionBillsResult> {
  const client = options.client ?? new NumazuSiteClient();
  const dependencies = options.dependencies ?? defaultDependencies;
  const url = NUMAZU_SITE_URLS.billDocuments;
  const fetched = await client.fetchHtml(url);
  const parsed = parseCurrentSessionBillsHtml(fetched.text, url);
  if (!parsed || parsed.bills.length === 0) {
    throw new Error(`開会中の会期または提出議案を読み取れなかった: ${url}`);
  }

  const sessionSlug = buildSessionSlug(parsed.year, parsed.sessionNumber);
  const previousHash = await dependencies.findContentHash(SOURCE, url);
  if (!options.force && previousHash === fetched.contentHash) {
    return {
      skipped: true,
      sessionSlug,
      billCount: parsed.bills.length,
      createdCount: 0,
      updatedCount: 0,
    };
  }
  let session = await dependencies.findCouncilSessionBySlug(sessionSlug);
  if (!session) {
    // 臨時会は定例会予定ページに事前掲載されない場合がある。開会中ページを根拠に
    // 暫定会期を作り、後日予定ページや結果PDFから得た情報で更新できるようにする。
    const today =
      options.today ??
      new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
    const id = await dependencies.ensureCouncilSession({
      name: buildSessionName({
        year: parsed.year,
        sessionNumber: parsed.sessionNumber,
        month: parsed.month,
        kind: parsed.kind,
      }),
      slug: sessionSlug,
      sessionNumber: parsed.sessionNumber,
      kind: parsed.kind,
      startDate: today,
      endDate: today,
      sourceUrl: url,
    });
    session = { id, startDate: today };
  }

  let createdCount = 0;
  // identity衝突は個別skipせずbatchを失敗させ、hashも保存しない。
  // 推測で処理済みにせず、次回実行でも人手確認が必要な状態を可視化する。
  for (const bill of parsed.bills) {
    const sourceRecordKey = buildNumazuBillSourceRecordKey({
      sessionSlug,
      numberKind: bill.numberKind,
      numberValue: bill.numberValue,
      submitter: bill.submitter,
    });
    if (bill.submitter !== null && sourceRecordKey === null) {
      throw new Error(
        `議案 ${bill.billNumber} の確定済み提出者から永続キーを生成できませんでした`
      );
    }
    const saved = await dependencies.upsertCurrentSessionBill({
      councilSessionId: session.id,
      sourceRecordKey,
      billNumber: bill.billNumber,
      numberKind: bill.numberKind,
      numberValue: bill.numberValue,
      name: bill.title,
      category: bill.category,
      submittedOn: bill.submittedOn ?? session.startDate,
      submitter: bill.submitter,
      sourceUrl: url,
      documentUrl: bill.documentUrl,
    });
    if (saved.created) createdCount += 1;
  }

  await dependencies.saveContentHash({
    source: SOURCE,
    url,
    contentHash: fetched.contentHash,
    etag: fetched.etag,
    lastModified: fetched.lastModified,
  });

  return {
    skipped: false,
    sessionSlug,
    billCount: parsed.bills.length,
    createdCount,
    updatedCount: parsed.bills.length - createdCount,
  };
}
