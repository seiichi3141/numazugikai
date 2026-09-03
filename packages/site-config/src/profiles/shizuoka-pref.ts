import type { RuntimeBlockedSiteProfile } from "../types";
import { SHARED_EXTERNAL_LINKS } from "./shared-external-links";

export const shizuokaPrefProfile = {
  id: "shizuoka-pref",
  runtime: {
    status: "blocked",
    reason:
      "静岡県議会向けの表示・データ取得・運用環境が未完成のため、まだ公開できません。",
  },
  branding: {
    name: "みらい議会＠静岡県",
    description:
      "静岡県議会でいま何が決まっているかを、わかりやすく伝えるプラットフォーム",
  },
  jurisdiction: {
    kind: "prefecture",
    name: "静岡県",
    councilName: "静岡県議会",
  },
  externalLinks: {
    ...SHARED_EXTERNAL_LINKS,
    report: null,
    councilOfficial: "https://www.pref.shizuoka.jp/kensei/kengikai/index.html",
    sourceTerms: "https://www.pref.shizuoka.jp/about/link.html",
  },
} as const satisfies RuntimeBlockedSiteProfile;
