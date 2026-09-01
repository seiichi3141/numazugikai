import type {
  AmivoiceMeeting,
  AmivoiceSession,
} from "../parsers/parse-amivoice-html";
import {
  amivoiceHtmlToText,
  parseAmivoiceMeetingList,
  parseAmivoiceSessionList,
} from "../parsers/parse-amivoice-html";

export const AMIVOICE_BASE_URL =
  "https://ami-search.amivoice.com/numazu/usr/search.exe";

/** 会議記録の閲覧ページ（人が開くリンク先） */
export function buildAmivoiceMinutesUrl(vcsv: string): string {
  return `${AMIVOICE_BASE_URL}?vcsv=${encodeURIComponent(vcsv)}&process=disp_base`;
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
      vcsv,
      spk_id: "",
      hits: "",
      all_hits: "",
    });
    return amivoiceHtmlToText(html);
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
