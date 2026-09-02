/**
 * OGP 画像で使う色。globals.css のトークンと同じ値。
 *
 * Satori は CSS 変数を読めないので実値を持つしかない。散らばると globals.css を
 * 変えたときに追従できないので、対応をここ1箇所に置く。
 */
export const OG_COLORS = {
  /** --color-mirai-text */
  text: "#1f2937",
  /** --color-mirai-text-secondary */
  textSecondary: "#404040",
  /** --color-mirai-text-muted */
  textMuted: "#6f6f74",
  /** --color-mirai-border */
  border: "#d2d2d2",
  /** --primary */
  primary: "#1b6ca8",
  /** --primary-accent */
  primaryAccent: "#14507c",
  /** --color-mirai-light-gradient-start */
  surfaceAccent: "#e3eef7",
  /** カードの地 */
  card: "white",
  /** --color-mirai-gradient-end → --color-mirai-gradient-start の順に流す */
  gradient:
    "linear-gradient(-30deg, rgb(207, 228, 242) 1%, rgb(90, 169, 214) 99%)",
  /** 画像全体の地。淡い空色から --background（#f7f4ee）へ。globals.css に対応トークンは無い */
  pageBackground:
    "linear-gradient(177deg, rgb(232, 242, 250) 0%, rgb(247, 244, 240) 100%)",
} as const;
