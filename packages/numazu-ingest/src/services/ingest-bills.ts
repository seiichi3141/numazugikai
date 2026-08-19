import { NumazuSiteClient } from "../fetchers/numazu-site-client";
import {
  buildSessionName,
  buildSessionSlug,
  toBillStatus,
  toStatusNote,
} from "../parsers/map-bill-status";
import { parseBillDocumentLinks } from "../parsers/parse-bill-document-links";
import { parseGianResultPdf } from "../parsers/parse-gian-result-pdf";
import {
  ensureCouncilSession,
  findContentHash,
  saveContentHash,
  updateBillDocumentUrl,
  upsertBill,
  upsertCommittee,
} from "../repositories/ingest-repository";
import {
  buildGianResultPdfUrl,
  buildReportTermUrl,
  NUMAZU_SITE_URLS,
} from "../shared/constants-site";
import type { ParsedBill } from "../shared/types";

const SOURCE = "gian_pdf";

export type IngestBillsParams = {
  /** 議員の期（例: 25） */
  term: number;
  /** 元号年（例: 8 = 令和8年） */
  eraYear: number;
  /** 定例会の開催月（例: 6） */
  month: number;
  /** 内容が変わっていなくても取り込み直す */
  force?: boolean;
  client?: NumazuSiteClient;
};

export type IngestBillsResult = {
  url: string;
  skipped: boolean;
  sessionSlug: string | null;
  councilSessionId: string | null;
  billCount: number;
};

/**
 * 1つの定例会の議案審議結果PDFを取り込む。
 *
 * PDFの内容が前回と同じならDBに触らずスキップする（相手サイトへの負荷とLLM費用を抑える）。
 * 議案本文PDFのリンクは「本会議のお知らせ」ページから拾って紐づけるが、
 * 本文そのものは保存せずURLだけを持つ。
 */
export async function ingestBillsForSession(
  params: IngestBillsParams
): Promise<IngestBillsResult> {
  const client = params.client ?? new NumazuSiteClient();
  const url = buildGianResultPdfUrl(params.term, params.eraYear, params.month);

  const fetched = await client.fetchPdfText(url);
  const previousHash = await findContentHash(SOURCE, url);
  if (!params.force && previousHash === fetched.contentHash) {
    return {
      url,
      skipped: true,
      sessionSlug: null,
      councilSessionId: null,
      billCount: 0,
    };
  }

  const parsed = parseGianResultPdf(fetched.text);
  if (parsed.sessionNumber === null || parsed.year === null) {
    throw new Error(`会期の見出しを読み取れなかった: ${url}`);
  }

  const sessionSlug = buildSessionSlug(parsed.year, parsed.sessionNumber);
  const kind = parsed.sessionLabel?.includes("臨時")
    ? ("extraordinary" as const)
    : ("regular" as const);
  const councilSessionId = await ensureCouncilSession({
    name: buildSessionName({
      year: parsed.year,
      sessionNumber: parsed.sessionNumber,
      month: parsed.month,
      kind,
      era: parsed.era ?? undefined,
    }),
    slug: sessionSlug,
    sessionNumber: parsed.sessionNumber,
    kind,
    // 会期予定ページが未取得のときの暫定値。議案の提出日・議決日から推定する
    startDate: earliestDate(parsed.bills) ?? `${parsed.year}-01-01`,
    endDate: latestDate(parsed.bills) ?? `${parsed.year}-12-31`,
    sourceUrl: buildReportTermUrl(params.term),
  });

  // 委員会は略称ごとに1度だけ登録する
  const committeeIds = new Map<string, string>();
  for (const shortName of collectCommitteeNames(parsed.bills)) {
    committeeIds.set(shortName, await upsertCommittee(shortName));
  }

  const billIdByNumber = new Map<string, string>();
  for (const bill of parsed.bills) {
    const billId = await upsertBill({
      councilSessionId,
      billNumber: bill.billNumber,
      numberKind: bill.numberKind,
      numberValue: bill.numberValue,
      name: bill.title,
      category: bill.category,
      legalBasis: bill.legalBasis,
      submittedOn: bill.submittedOn,
      submitter: bill.submitter,
      committeeId: bill.committee
        ? (committeeIds.get(bill.committee) ?? null)
        : null,
      committeeResult: bill.committeeResult,
      decidedOn: bill.decidedOn,
      status: toBillStatus(bill.decision, bill.committee),
      statusNote: toStatusNote(
        bill.decision,
        bill.committee,
        bill.committeeResult
      ),
      sourceUrl: buildReportTermUrl(params.term),
      documentUrl: null,
    });
    billIdByNumber.set(bill.billNumber, billId);
  }

  await attachDocumentUrls(client, billIdByNumber);
  await saveContentHash({
    source: SOURCE,
    url,
    contentHash: fetched.contentHash,
    etag: fetched.etag,
    lastModified: fetched.lastModified,
  });

  return {
    url,
    skipped: false,
    sessionSlug,
    councilSessionId,
    billCount: parsed.bills.length,
  };
}

/**
 * 「本会議のお知らせ」ページから議案本文PDFのリンクを拾い、議案に紐づける。
 *
 * このページは開会中の定例会のものしか載らないため、過去の会期では
 * 一致する議案がないのが正常。取得に失敗しても議案の取り込み自体は成立させる。
 */
async function attachDocumentUrls(
  client: NumazuSiteClient,
  billIdByNumber: ReadonlyMap<string, string>
): Promise<number> {
  let attached = 0;
  try {
    const page = await client.fetchHtml(NUMAZU_SITE_URLS.billDocuments);
    const links = parseBillDocumentLinks(
      page.text,
      NUMAZU_SITE_URLS.billDocuments
    );
    for (const link of links) {
      const billId = billIdByNumber.get(link.billNumber);
      if (!billId) continue;
      await updateBillDocumentUrl(billId, link.url);
      attached += 1;
    }
  } catch (error) {
    console.warn(
      `議案本文リンクの取得に失敗した（議案の取り込みは継続する）: ${String(error)}`
    );
  }
  return attached;
}

function collectCommitteeNames(bills: readonly ParsedBill[]): string[] {
  const names = new Set<string>();
  for (const bill of bills) {
    // 「省略」は付託を省略した意味なので委員会ではない
    if (bill.committee && bill.committee !== "省略") names.add(bill.committee);
  }
  return [...names];
}

function earliestDate(bills: readonly ParsedBill[]): string | null {
  const dates = bills
    .map((bill) => bill.submittedOn)
    .filter(Boolean) as string[];
  return dates.length > 0 ? dates.sort()[0] : null;
}

function latestDate(bills: readonly ParsedBill[]): string | null {
  const dates = bills
    .flatMap((bill) => [bill.submittedOn, bill.decidedOn])
    .filter(Boolean) as string[];
  return dates.length > 0 ? dates.sort()[dates.length - 1] : null;
}
