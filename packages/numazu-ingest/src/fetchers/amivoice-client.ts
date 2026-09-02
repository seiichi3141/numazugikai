import type {
  AmivoiceMeeting,
  AmivoiceSession,
} from "../parsers/parse-amivoice-html";
import {
  amivoiceHtmlToText,
  parseAmivoiceMeetingList,
  parseAmivoiceSessionList,
} from "../parsers/parse-amivoice-html";
import {
  type AmivoiceSearchHit,
  parseAmivoiceHitCount,
  parseAmivoiceSearchResult,
} from "../parsers/parse-amivoice-search";

/** 検索結果の1ページあたりの件数（「次の30件」ボタンに対応） */
const PAGE_SIZE = 30;

/**
 * 会議体の種類（sch_mean）。画面では委員会ごとのチェックボックスにあたる。
 *
 * ここを絞ると特定の委員会しか返らない。既定でひとつ（001）しか送らないと
 * 文教産業委員会に偏り、他の常任委員会が丸ごと落ちる
 * （2019〜2021年で 32件 → 全10種なら 365件）。網羅するには全部送る。
 */
const ALL_MEANS = [
  "001",
  "002",
  "003",
  "004",
  "005",
  "006",
  "007",
  "008",
  "009",
  "000",
] as const;

/** 結果ページに「次の30件」があるか */
function hasNextPage(html: string): boolean {
  return html.includes("btn_next30");
}

export const AMIVOICE_BASE_URL =
  "https://ami-search.amivoice.com/numazu/usr/search.exe";

/**
 * 会議記録の識別子に `.vcsv` を付ける。
 *
 * 検索結果（DataSubmit2）は拡張子なしで返すのに、本文・閲覧ページの
 * URLは拡張子付きを要求する。付け忘れると本文が0字で返り、
 * エラーにもならないまま取り込みが空振りする。
 */
export function withVcsvExtension(vcsv: string): string {
  return vcsv.endsWith(".vcsv") ? vcsv : `${vcsv}.vcsv`;
}

/** 会議記録の閲覧ページ（人が開くリンク先） */
export function buildAmivoiceMinutesUrl(vcsv: string): string {
  return `${AMIVOICE_BASE_URL}?vcsv=${encodeURIComponent(withVcsvExtension(vcsv))}&process=disp_base`;
}

const DEFAULT_USER_AGENT =
  "mirai-gikai-numazu/0.1 (+https://github.com/seiichi3141/numazugikai)";

export type AmivoiceClientOptions = {
  baseUrl?: string;
  fetchImpl?: typeof globalThis.fetch;
  /** 連続アクセスの間隔（ミリ秒）。相手サイトへの負荷を抑えるため既定で1秒あける */
  minIntervalMs?: number;
  userAgent?: string;
  sleep?: (ms: number) => Promise<void>;
};

/**
 * 沼津市議会の会議記録検索システム（AmiVoice）クライアント。
 *
 * 議会中継（DiscussVision）より会議記録の公開が早く、さらに委員会の記録もある。
 * 沼津市は個人情報保護のため発言の一部を伏せて「会議記録」として公開しており、
 * 正式な会議録とは異なる点に留意する。
 */
export class AmivoiceClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly minIntervalMs: number;
  private readonly userAgent: string;
  private readonly sleep: (ms: number) => Promise<void>;
  private lastRequestAt = 0;

  constructor(options: AmivoiceClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? AMIVOICE_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.minIntervalMs = options.minIntervalMs ?? 1000;
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.sleep =
      options.sleep ??
      ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  /** 会期（定例会・臨時会）と委員会の一覧を返す。 */
  async listSessions(): Promise<AmivoiceSession[]> {
    const html = await this.get({ process: "list_vcsm" });
    return parseAmivoiceSessionList(html);
  }

  /** 会期・委員会に属する会議（1日分）の一覧を返す。 */
  async listMeetings(vcsm: string): Promise<AmivoiceMeeting[]> {
    const html = await this.get({ vcsm, process: "list" });
    return parseAmivoiceMeetingList(html);
  }

  /**
   * 会議記録の本文をテキストで返す。
   *
   * 本文は永続化しないこと。議案ごとの説明・討論の抽出材料としてその場で
   * 使い切り、原文は閲覧ページ（buildAmivoiceMinutesUrl）へリンクする。
   */
  async getMinutesText(vcsv: string): Promise<string> {
    const html = await this.get({
      process: "disp_right",
      // 検索結果は拡張子なしのID（v20260518_01）を返すが、
      // 本文の取得には .vcsv が要る。付いていなければ補う
      vcsv: withVcsvExtension(vcsv),
      spk_id: "",
      hits: "",
      all_hits: "",
    });
    return amivoiceHtmlToText(html);
  }

  /**
   * 会議記録を検索して、該当する会議記録を探す。
   *
   * トップページ（listSessions）は直近の会期しか載せないが、この検索は
   * 2015年まで遡れる。
   *
   * 検索語は空でよい。空にすると期間内の会議記録がすべて返るため、
   * 網羅的に拾いたい場合は語を指定しないこと（語を指定するとその語を
   * 含む記録だけに絞られ、取りこぼす。2019年で 7件→10件 の差が出た）。
   *
   * @param word 検索語。省略・空で期間内の全件
   * @param range 期間。省略時は全期間
   */
  async searchMinutes(params: {
    word?: string;
    range?: { from: Date; to: Date };
    /** 会議種別。既定は定例会・臨時会・全員協議会・その他のすべて */
    meetingTypes?: readonly string[];
    /** 取得するページ数の上限。既定は制限なし（全件） */
    maxPages?: number;
  }): Promise<{ hitCount: number | null; hits: AmivoiceSearchHit[] }> {
    const hits: AmivoiceSearchHit[] = [];
    const seen = new Set<string>();
    let hitCount: number | null = null;
    let curId = 0;
    let pages = 0;

    // 結果は1ページ30件。「次の30件」は fnSort(cur_id, 0) で
    // process=search_detail に cur_id を付けて再送する仕組み
    while (params.maxPages === undefined || pages < params.maxPages) {
      const html = await this.postSearch(params, curId);
      if (hitCount === null) hitCount = parseAmivoiceHitCount(html);

      const page = parseAmivoiceSearchResult(html);
      let added = 0;
      for (const hit of page) {
        if (seen.has(hit.vcsv)) continue;
        seen.add(hit.vcsv);
        hits.push(hit);
        added += 1;
      }

      pages += 1;
      // 次ページが無い、または新規が1件も増えなければ打ち切る
      if (!hasNextPage(html) || added === 0) break;
      curId += PAGE_SIZE;
    }

    hits.sort((a, b) => a.date.localeCompare(b.date));
    return { hitCount, hits };
  }

  private postSearch(
    params: {
      word?: string;
      range?: { from: Date; to: Date };
      meetingTypes?: readonly string[];
    },
    curId: number
  ): Promise<string> {
    const types = params.meetingTypes ?? ["001", "002", "003", "004"];
    const from = params.range?.from;
    const to = params.range?.to;

    const form = new URLSearchParams();
    form.append("process", "search_detail");
    // 検索語は空にする。語を指定すると、その語を含む記録だけに絞られて取りこぼす
    form.append("word_and", params.word ?? "");
    form.append("word_or", "");
    for (const type of types) form.append("sch_type", type);
    for (const mean of ALL_MEANS) form.append("sch_mean", mean);
    // 003 = 本文。議案説明や質疑は本文にあるため他の部分は見ない
    form.append("sch_prt", "003");
    form.append("sch_spk", "0");
    form.append("sch_exc", "0");
    // 0 を渡すと期間指定なしになる
    form.append("year1", from ? String(from.getFullYear()) : "0");
    form.append("month1", from ? String(from.getMonth() + 1) : "0");
    form.append("day1", from ? String(from.getDate()) : "0");
    form.append("year2", to ? String(to.getFullYear()) : "0");
    form.append("month2", to ? String(to.getMonth() + 1) : "0");
    form.append("day2", to ? String(to.getDate()) : "0");
    form.append("cur_id", String(curId));
    form.append("srt_change", "0");

    return this.post(form);
  }

  private async post(form: URLSearchParams): Promise<string> {
    await this.throttle();
    const response = await this.fetchImpl(this.baseUrl, {
      method: "POST",
      headers: {
        "User-Agent": this.userAgent,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    if (!response.ok) {
      throw new Error(
        `会議記録検索システムが ${response.status} を返した（検索）`
      );
    }
    return response.text();
  }

  private async get(params: Record<string, string>): Promise<string> {
    await this.throttle();
    const query = new URLSearchParams(params);
    const url = `${this.baseUrl}?${query}`;
    const response = await this.fetchImpl(url, {
      headers: { "User-Agent": this.userAgent },
    });
    if (!response.ok) {
      throw new Error(
        `会議記録検索システムが ${response.status} を返した: ${url}`
      );
    }
    return response.text();
  }

  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (this.lastRequestAt > 0 && elapsed < this.minIntervalMs) {
      await this.sleep(this.minIntervalMs - elapsed);
    }
    this.lastRequestAt = Date.now();
  }
}
