import { numazuCityProfile } from "./profiles/numazu-city";
import { shizuokaPrefProfile } from "./profiles/shizuoka-pref";
import type { SiteProfileRegistry } from "./types";

export { numazuCityProfile, shizuokaPrefProfile };

export const siteProfiles = {
  "numazu-city": numazuCityProfile,
  "shizuoka-pref": shizuokaPrefProfile,
} as const satisfies SiteProfileRegistry;
