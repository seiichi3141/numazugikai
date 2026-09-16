import { resolveSiteProfile } from "@mirai-gikai/site-config/resolve-site-profile";

/** 管理画面と生成処理が共有する実行時の自治体設定。 */
export const SITE_PROFILE = resolveSiteProfile(process.env.NEXT_PUBLIC_SITE_ID);
