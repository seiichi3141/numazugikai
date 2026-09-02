import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  amivoiceHtmlToText,
  parseAmivoiceMeetingList,
  parseAmivoiceSessionLabel,
  parseAmivoiceSessionList,
} from "./parse-amivoice-html";
import { extractBillExplanations, extractDebates } from "./parse-minutes";

const FIXTURES = join(import.meta.dirname, "__fixtures__");
const loadFixture = (name: string) =>
  readFileSync(join(FIXTURES, name), "utf-8");

describe("parseAmivoiceSessionList: 実際のトップページ", () => {
  const sessions = parseAmivoiceSessionList(
    loadFixture("amivoice-session-list.html")
  );

  it("会期と委員会を種別つきで取る", () => {
    const labels = new Map(sessions.map((s) => [s.label, s]));
    expect(labels.get("令和8年第13回定例会")).toMatchObject({
      vcsm: "m20260513_01.vcsm",
      kind: "session",
    });
    expect(labels.get("民生病院教育委員会")).toMatchObject({
      vcsm: "---3",
      kind: "committee",
    });
  });

  it("臨時会も会期として取る", () => {
    const extra = sessions.find((s) => s.label === "令和8年第2回臨時会");
    expect(extra?.kind).toBe("session");
  });

  it("常任4委員会と予算決算2委員会がそろう", () => {
    const committees = sessions
      .filter((s) => s.kind === "committee")
      .map((s) => s.label);
    for (const name of [
      "総務経済委員会",
      "民生病院教育委員会",
      "建設水道危機管理委員会",
      "一般会計予算決算委員会",
      "特別会計企業会計予算決算委員会",
    ]) {
      expect(committees).toContain(name);
    }
  });

  it("空のHTMLでは空配列", () => {
    expect(parseAmivoiceSessionList("")).toEqual([]);
  });
});

describe("parseAmivoiceMeetingList: 実際の会議一覧", () => {
  const meetings = parseAmivoiceMeetingList(
    loadFixture("amivoice-meeting-list.html")
  );

  it("令和8年6月定例会の全5日分を取る", () => {
    expect(meetings).toHaveLength(5);
    expect(meetings[0]).toEqual({
      vcsv: "v20260513_02.vcsv",
      date: "2026-06-05",
      label: "令和8年第13回定例会（第1日）",
    });
    expect(meetings[4].date).toBe("2026-06-29");
  });

  it("空のHTMLでは空配列", () => {
    expect(parseAmivoiceMeetingList("")).toEqual([]);
  });
});

describe("amivoiceHtmlToText: 会議記録本文の変換", () => {
  it("発言者と本文の組に直し、既存の会議録パーサがそのまま使える", () => {
    const text = amivoiceHtmlToText(loadFixture("amivoice-plenary-day1.html"));
    expect(text).toContain("○議長（梶　泰久）");
    // 会議中継（DiscussVision）には無かった6月定例会の議案説明が取れる
    const explanations = extractBillExplanations(text);
    expect(explanations.length).toBeGreaterThanOrEqual(20);

    const report = explanations.find((e) => e.billNumber === "報第18号");
    expect(report?.body).toContain("継続費繰越計算書");
  });

  it("採決の宣告（「発議第4号は可決されました」）を説明として拾わない", () => {
    const text = amivoiceHtmlToText(loadFixture("amivoice-plenary-day1.html"));
    const explanations = extractBillExplanations(text);
    const hatsugi = explanations.find((e) => e.billNumber === "発議第4号");
    expect(hatsugi).toBeUndefined();
  });

  it("6月定例会の討論も既存パーサで取れる", () => {
    const text = amivoiceHtmlToText(loadFixture("amivoice-plenary-day5.html"));
    const debates = extractDebates(text);
    // 認第31号（監査委員の選任）に日本共産党の川口議員が反対討論
    expect(debates).toContainEqual(
      expect.objectContaining({
        billNumber: "認第31号",
        speakerName: "川口　慶",
        stance: "against",
      })
    );
  });

  it("タグ・実体参照を落とした平文にする", () => {
    const text = amivoiceHtmlToText(
      loadFixture("amivoice-committee-minutes.html")
    );
    expect(text).not.toContain("<");
    expect(text).not.toContain("&nbsp;");
    expect(text.length).toBeGreaterThan(10000);
  });
});

describe("parseAmivoiceSessionLabel", () => {
  it("定例会のラベルから西暦年と回次を取る", () => {
    expect(parseAmivoiceSessionLabel("令和8年第13回定例会")).toEqual({
      year: 2026,
      sessionNumber: 13,
    });
  });

  it("臨時会も取れる", () => {
    expect(parseAmivoiceSessionLabel("令和8年第2回臨時会")).toEqual({
      year: 2026,
      sessionNumber: 2,
    });
  });

  it("委員会名は null", () => {
    expect(parseAmivoiceSessionLabel("民生病院教育委員会")).toBeNull();
    expect(parseAmivoiceSessionLabel("全員協議会")).toBeNull();
  });
});
