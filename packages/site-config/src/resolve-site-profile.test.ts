import { describe, expect, it } from "vitest";
import { numazuCityProfile, shizuokaPrefProfile } from "./profiles";
import {
  assertSiteProfileIsRuntimeReady,
  isSiteId,
  resolveSiteProfile,
} from "./resolve-site-profile";

describe("isSiteId", () => {
  it.each([
    "numazu-city",
    "shizuoka-pref",
  ])("%s を既知の自治体IDとして扱う", (siteId) => {
    expect(isSiteId(siteId)).toBe(true);
  });

  it.each([
    "",
    "numazu",
    "shizuoka-city",
  ])("%s を未知の自治体IDとして拒否する", (siteId) => {
    expect(isSiteId(siteId)).toBe(false);
  });
});

describe("resolveSiteProfile", () => {
  it("未設定の既存環境では沼津市版を選ぶ", () => {
    expect(resolveSiteProfile(undefined)).toBe(numazuCityProfile);
  });

  it("numazu-city では従来の表示値と外部リンクを返す", () => {
    const profile = resolveSiteProfile("numazu-city");

    expect(profile.branding).toEqual({
      name: "みらい議会＠沼津市",
      description:
        "沼津市議会でいま何が決まっているかを、わかりやすく伝えるプラットフォーム",
    });
    expect(profile.features).toEqual({ showComingSoonBills: false });
    expect(profile.externalLinks).toEqual({
      forkGuidelinesNote: "https://note.com/team_mirai_jp/n/nc59ec347e8c7",
      githubRepository: "https://github.com/seiichi3141/numazugikai",
      upstreamService: "https://gikai.team-mir.ai/",
      report: "https://forms.gle/wJXXMt6cv2ZdiCgg6",
      councilOfficial:
        "https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/index.htm",
    });
  });

  it("未知の自治体IDをfail closedで拒否する", () => {
    expect(() => resolveSiteProfile("unknown-site")).toThrowError(
      'Unsupported site id "unknown-site". Expected one of: numazu-city, shizuoka-pref.'
    );
  });

  it("準備中の静岡県版を有効化できない", () => {
    expect(() => resolveSiteProfile("shizuoka-pref")).toThrowError(
      'Site "shizuoka-pref" is not ready for runtime activation'
    );
  });
});

describe("assertSiteProfileIsRuntimeReady", () => {
  it("準備中profileを個別に利用しようとしても拒否する", () => {
    expect(shizuokaPrefProfile.features).toEqual({
      showComingSoonBills: true,
    });
    expect(() =>
      assertSiteProfileIsRuntimeReady(shizuokaPrefProfile)
    ).toThrowError("静岡県議会向けの表示・データ取得・運用環境が未完成");
  });
});
