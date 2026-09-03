import {
  type Council,
  councilListSchema,
  type GroupMemberList,
  groupMemberListSchema,
  minuteTextSchema,
  type SpeakerList,
  speakerListSchema,
  type YearListItem,
  yearListSchema,
} from "../shared/discussvision-schemas";

/** 沼津市議会のテナントID。議会中継ページの tenant.js に埋め込まれている値。 */
export const NUMAZU_TENANT_ID = "436";

export const DISCUSSVISION_BASE_URL = "https://smart.discussvision.net/dvsapi";

/** 会議の再生ページ。原文・映像はここへリンクする（本サービスでは再配信しない）。 */
export function buildCouncilWatchUrl(
  councilId: string,
  scheduleId: string,
  playlistId: string,
  speakerId: string | null,
  targetYear: string
): string {
  const params = new URLSearchParams({
    council_id: councilId,
    schedule_id: scheduleId,
    playlist_id: playlistId,
    // DiscussVision は発言者が紐づかない項目でも文字列 "null" を要求する。
    // 省略すると内部 API に speaker_id=undefined が渡り、エラー画面になる。
    speaker_id: speakerId ?? "null",
    target_year: targetYear,
  });
  return `https://smart.discussvision.net/smart/tenant/numazu/WebView/rd/speech.html?${params}`;
}

/** テストで差し替えられるように fetch を注入する。 */
export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal }
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

export type DiscussVisionClientOptions = {
  tenantId?: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
  /** 連続アクセスの間隔（ミリ秒）。相手サイトへの負荷を抑えるため既定で1秒あける。 */
  minIntervalMs?: number;
  /** 問い合わせ先を明示するための User-Agent */
  userAgent?: string;
  sleep?: (ms: number) => Promise<void>;
};

const DEFAULT_USER_AGENT =
  "mirai-gikai-numazu/0.1 (+https://github.com/seiichi3141/numazugikai)";

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 議会中継システム（DiscussVision SMART）の公開JSON APIクライアント。
 *
 * 認証は不要だが非公式APIのため、
 * - レスポンスは必ず Zod で検証する（形が変わったら静かに壊れず落とす）
 * - 相手サイトに負荷をかけないよう連続リクエストの間隔をあける
 * を守る。
 */
export class DiscussVisionClient {
  private readonly tenantId: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly minIntervalMs: number;
  private readonly userAgent: string;
  private readonly sleep: (ms: number) => Promise<void>;
  private lastRequestAt = 0;

  constructor(options: DiscussVisionClientOptions = {}) {
    this.tenantId = options.tenantId ?? NUMAZU_TENANT_ID;
    this.baseUrl = options.baseUrl ?? DISCUSSVISION_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchLike);
    this.minIntervalMs = options.minIntervalMs ?? 1000;
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.sleep = options.sleep ?? defaultSleep;
  }

  /** 年度一覧を新しい順で返す。 */
  async getYearList(): Promise<YearListItem[]> {
    const json = await this.request("yearlist", {});
    return yearListSchema.parse(json);
  }

  /** 指定年の会議一覧（日程・発言つき）を返す。 */
  async getCouncils(year: number): Promise<Council[]> {
    const json = await this.request("councilrd/all", { year: String(year) });
    return councilListSchema.parse(json);
  }

  /** 会派と所属議員の一覧を返す。 */
  async getGroupMembers(): Promise<GroupMemberList> {
    const json = await this.request("group/memberlist", { type: "1" });
    return groupMemberListSchema.parse(json);
  }

  /** 議員一覧（氏名・かな・会派・顔写真）を返す。 */
  async getSpeakers(): Promise<SpeakerList> {
    const json = await this.request("speaker/list", { search_index: "1" });
    return speakerListSchema.parse(json);
  }

  /**
   * 発言の全文テキストを返す。
   *
   * 取得した本文は永続化しない。解析（論点抽出・要約）の材料として
   * その場で使い切ること。原文は公式の再生ページへリンクする。
   */
  async getMinuteText(
    councilId: string,
    scheduleId: string,
    playlistId: string
  ): Promise<string> {
    const json = await this.request("minute/text", {
      council_id: councilId,
      schedule_id: scheduleId,
      playlist_id: playlistId,
    });
    return minuteTextSchema
      .parse(json)
      .map((entry) => entry.minute_text)
      .join("\n");
  }

  private async request(
    path: string,
    params: Record<string, string>
  ): Promise<unknown> {
    await this.throttle();

    const query = new URLSearchParams({ tenant_id: this.tenantId, ...params });
    const url = `${this.baseUrl}/${path}?${query}`;
    const response = await this.fetchImpl(url, {
      headers: { "User-Agent": this.userAgent, Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(
        `DiscussVision API ${path} が ${response.status} を返した: ${url}`
      );
    }

    const body = await response.text();
    try {
      return JSON.parse(body);
    } catch {
      throw new Error(
        `DiscussVision API ${path} のレスポンスがJSONではない: ${body.slice(0, 200)}`
      );
    }
  }

  /** 直前のリクエストから minIntervalMs 経つまで待つ。 */
  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (this.lastRequestAt > 0 && elapsed < this.minIntervalMs) {
      await this.sleep(this.minIntervalMs - elapsed);
    }
    this.lastRequestAt = Date.now();
  }
}
