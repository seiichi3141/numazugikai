import type { RuntimeReadySiteProfile } from "../types";
import { SHARED_EXTERNAL_LINKS } from "./shared-external-links";

export const numazuCityProfile = {
  id: "numazu-city",
  runtime: { status: "ready" },
  branding: {
    name: "みらい議会＠沼津市",
    description:
      "沼津市議会でいま何が決まっているかを、わかりやすく伝えるプラットフォーム",
  },
  jurisdiction: {
    kind: "city",
    name: "沼津市",
    councilName: "沼津市議会",
  },
  features: {
    showComingSoonBills: false,
  },
  externalLinks: {
    ...SHARED_EXTERNAL_LINKS,
    report: "https://forms.gle/wJXXMt6cv2ZdiCgg6",
    councilOfficial:
      "https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/index.htm",
  },
} as const satisfies RuntimeReadySiteProfile;
