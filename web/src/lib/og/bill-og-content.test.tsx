import { describe, expect, it } from "vitest";
import { BillOgContent, type BillOgContentProps } from "./bill-og-content";

const props: BillOgContentProps = {
  logoDataUrl: "data:image/png;base64,logo",
  title: "市営墓地の使用料を見直し",
  summary: "市営墓地の使用料と管理料を改定する議案です",
  meta: ["議第63号", "2026.6.29 提出"],
  status: "可決",
  tags: ["暮らし・まちづくり"],
};

describe("BillOgContent", () => {
  it("トップページと共通のブランド表現と議案情報を描く", () => {
    const json = JSON.stringify(BillOgContent(props));

    for (const text of [
      "みらい議会",
      "＠沼津市",
      "NUMAZU CITY COUNCIL GUIDE",
      "市営墓地の使用料を見直し",
      "市営墓地の使用料と管理料を改定する議案です",
      "可決",
      "議第63号",
      "2026.6.29 提出",
      "暮らし・まちづくり",
      "沼津市・沼津市議会の公式サービスではありません",
      "data:image/png;base64,logo",
    ]) {
      expect(json).toContain(text);
    }
  });

  it("Satoriを停止させるwordBreakを文章ブロックへ渡さない", () => {
    expect(JSON.stringify(BillOgContent(props))).not.toContain('"wordBreak"');
  });
});
