import { resolveSiteProfile } from "@mirai-gikai/site-config/resolve-site-profile";

/** metadata、OGP、外部リンクが共有する実行時の自治体設定。 */
export const SITE_PROFILE = resolveSiteProfile(process.env.NEXT_PUBLIC_SITE_ID);

/** 既存importとの互換性を保つサービス名と説明。 */
export const SITE_NAME = SITE_PROFILE.branding.name;
export const SITE_DESCRIPTION = SITE_PROFILE.branding.description;
