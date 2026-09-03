import { siteProfiles } from "./profiles";
import {
  type RuntimeReadySiteProfile,
  SITE_IDS,
  type SiteId,
  type SiteProfile,
} from "./types";

export const DEFAULT_SITE_ID: SiteId = "numazu-city";

export function isSiteId(value: string): value is SiteId {
  return (SITE_IDS as readonly string[]).includes(value);
}

export function assertSiteProfileIsRuntimeReady(
  profile: SiteProfile
): asserts profile is RuntimeReadySiteProfile {
  if (profile.runtime.status !== "ready") {
    throw new Error(
      `Site "${profile.id}" is not ready for runtime activation: ${profile.runtime.reason}`
    );
  }
}

/**
 * 環境変数の値だけを入力として、実行可能な自治体設定を解決する純粋関数。
 *
 * 環境変数をまだ持たない既存環境では、従来どおり沼津市版を選ぶ。
 * 未知の値や準備中の自治体は、別自治体の設定で起動しないよう fail closed にする。
 */
export function resolveSiteProfile(
  configuredSiteId: string | undefined
): RuntimeReadySiteProfile {
  const siteId = configuredSiteId ?? DEFAULT_SITE_ID;

  if (!isSiteId(siteId)) {
    throw new Error(
      `Unsupported site id "${siteId}". Expected one of: ${SITE_IDS.join(", ")}.`
    );
  }

  const profile: SiteProfile = siteProfiles[siteId];
  assertSiteProfileIsRuntimeReady(profile);
  return profile;
}
