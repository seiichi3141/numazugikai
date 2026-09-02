/**
 * OGP 画像の URL。
 *
 * API のパスはここだけが知る。`@/lib/routes` は page.tsx と 1:1 の契約で
 * API を含めないので、別に置く。
 */
export const ogImageUrls = {
  /**
   * 議案（サイト内の相対パス）。`version` に更新日時などを渡すと URL が変わり、
   * SNS や CDN のキャッシュを自然に更新できる。画像側は version 付きなら
   * 長期キャッシュにする。
   */
  billPath(billId: string, version?: string | null): string {
    const params = new URLSearchParams({ id: billId });
    if (version) params.set("v", version);
    return `/api/og/bill?${params.toString()}`;
  },
  /** 議案（絶対 URL）。metadata の og:image に使う */
  bill(billId: string, webUrl: string, version?: string | null): string {
    return new URL(ogImageUrls.billPath(billId, version), webUrl).toString();
  },
  report(reportId: string, webUrl: string): string {
    const url = new URL("/api/og/report", webUrl);
    url.searchParams.set("id", reportId);
    return url.toString();
  },
  /** サイト共通。トップや一覧など議案に紐づかないページ */
  site(webUrl: string): string {
    return new URL("/api/og/site", webUrl).toString();
  },
};
