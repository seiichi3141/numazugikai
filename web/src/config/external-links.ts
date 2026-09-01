/**
 * 外部リンク定数
 */

/** 沼津市議会の公式ページ。議会の仕組み・日程などの一次情報はここに委ねる */
const NUMAZU_COUNCIL_OFFICIAL =
  "https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/index.htm";

export const EXTERNAL_LINKS = {
  REPORT: "https://forms.gle/wJXXMt6cv2ZdiCgg6",
  NUMAZU_COUNCIL: NUMAZU_COUNCIL_OFFICIAL,
  /** フォーク元「みらい議会」の自主制作ガイドライン */
  FORK_GUIDELINES_NOTE: "https://note.com/team_mirai_jp/n/nc59ec347e8c7",
  GITHUB_REPO: "https://github.com/seiichi3141/numazugikai",

  /**
   * フォーク元の本家サービス。
   *
   * 本家の FORK_GUIDELINES が掲載を推奨しており、免責文言と合わせて
   * フッターから参照する。
   */
  UPSTREAM_SERVICE: "https://gikai.team-mir.ai/",
} as const;
