import { SITE_PROFILE } from "@/lib/site";

/**
 * 外部リンク定数
 */

/** 既存importとの互換性を保つ外部リンクのファサード。 */
export const EXTERNAL_LINKS = {
  REPORT: SITE_PROFILE.externalLinks.report,
  COUNCIL_OFFICIAL: SITE_PROFILE.externalLinks.councilOfficial,
  /** @deprecated 新規コードでは COUNCIL_OFFICIAL を使用する。 */
  NUMAZU_COUNCIL: SITE_PROFILE.externalLinks.councilOfficial,
  /** フォーク元「みらい議会」の自主制作ガイドライン */
  FORK_GUIDELINES_NOTE: SITE_PROFILE.externalLinks.forkGuidelinesNote,
  GITHUB_REPO: SITE_PROFILE.externalLinks.githubRepository,

  /**
   * フォーク元の本家サービス。
   *
   * 本家の FORK_GUIDELINES が掲載を推奨しており、免責文言と合わせて
   * フッターから参照する。
   */
  UPSTREAM_SERVICE: SITE_PROFILE.externalLinks.upstreamService,
} as const;
