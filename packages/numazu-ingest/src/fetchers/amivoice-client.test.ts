import { describe, expect, it, vi } from "vitest";
import { AmivoiceClient } from "./amivoice-client";

/** 検索結果ページの最小構成。next の有無を切り替えられる */
function resultPage(params: {
  total: number;
  items: { date: string; vcsv: string; name: string }[];
  hasNext: boolean;
}): string {
  const rows = params.items
    .map(
      (item, i) =>
        `<tr><td>［ ${i + 1}］</td><td>${item.date}</td>` +
        `<td><a onClick="DataSubmit2('${item.vcsv}.vcsv','','','')">` +
        `${item.name} 令和6年1月1日（月）</a></td></tr>`
    )
    .join("");
  const next = params.hasNext
    ? `<a onClick="fnSort( 30, 0 );"><img src="images/btn_next30.gif"></a>`
    : "";
  return `<div>${params.total} 件の文書、 ${params.total} 件の発言が該当しました。</div>
    <table>${rows}</table>${next}`;
}

function fakeFetch(pages: string[]) {
  const bodies: string[] = [];
  const impl = vi.fn(async (_url: string, init?: { body?: string }) => {
    bodies.push(init?.body ?? "");
    const html = pages[Math.min(bodies.length - 1, pages.length - 1)];
    return { ok: true, status: 200, text: async () => html } as Response;
  });
  return { impl: impl as unknown as typeof globalThis.fetch, bodies };
}

const noSleep = async () => {};

describe("AmivoiceClient.searchMinutes: 検索パラメータ", () => {
  it("会議体の種類(sch_mean)を全10種送る", async () => {
    // ひとつしか送らないと文教産業委員会に偏り、他の常任委員会が落ちる
    const { impl, bodies } = fakeFetch([
      resultPage({ total: 1, items: [], hasNext: false }),
    ]);
    const client = new AmivoiceClient({ fetchImpl: impl, sleep: noSleep });
    await client.searchMinutes({});

    const means = [...bodies[0].matchAll(/sch_mean=(\d{3})/g)].map((m) => m[1]);
    expect(means).toEqual([
      "001",
      "002",
      "003",
      "004",
      "005",
      "006",
      "007",
      "008",
      "009",
      "000",
    ]);
  });

  it("検索語は既定で空にする（語を入れると絞られて取りこぼす）", async () => {
    const { impl, bodies } = fakeFetch([
      resultPage({ total: 0, items: [], hasNext: false }),
    ]);
    const client = new AmivoiceClient({ fetchImpl: impl, sleep: noSleep });
    await client.searchMinutes({});
    expect(bodies[0]).toContain("word_and=&");
  });

  it("期間を渡すと年月日に展開する", async () => {
    const { impl, bodies } = fakeFetch([
      resultPage({ total: 0, items: [], hasNext: false }),
    ]);
    const client = new AmivoiceClient({ fetchImpl: impl, sleep: noSleep });
    await client.searchMinutes({
      range: { from: new Date(2019, 0, 1), to: new Date(2021, 11, 31) },
    });
    expect(bodies[0]).toContain("year1=2019");
    expect(bodies[0]).toContain("month1=1");
    expect(bodies[0]).toContain("year2=2021");
    expect(bodies[0]).toContain("month2=12");
    expect(bodies[0]).toContain("day2=31");
  });

  it("期間を省くと全期間（0）で検索する", async () => {
    const { impl, bodies } = fakeFetch([
      resultPage({ total: 0, items: [], hasNext: false }),
    ]);
    const client = new AmivoiceClient({ fetchImpl: impl, sleep: noSleep });
    await client.searchMinutes({});
    expect(bodies[0]).toContain("year1=0");
    expect(bodies[0]).toContain("year2=0");
  });
});

describe("AmivoiceClient.searchMinutes: ページング", () => {
  const page1 = resultPage({
    total: 45,
    items: [
      { date: "2024/01/10", vcsv: "v20240110_01", name: "総務経済委員会" },
      { date: "2024/02/10", vcsv: "v20240210_01", name: "民生病院教育委員会" },
    ],
    hasNext: true,
  });
  const page2 = resultPage({
    total: 45,
    items: [
      {
        date: "2023/05/10",
        vcsv: "v20230510_01",
        name: "建設水道危機管理委員会",
      },
    ],
    hasNext: false,
  });

  it("「次の30件」がある限り cur_id を進めて全件集める", async () => {
    const { impl, bodies } = fakeFetch([page1, page2]);
    const client = new AmivoiceClient({ fetchImpl: impl, sleep: noSleep });
    const result = await client.searchMinutes({});

    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toContain("cur_id=0");
    expect(bodies[1]).toContain("cur_id=30");
    expect(result.hits.map((h) => h.vcsv)).toEqual([
      "v20230510_01",
      "v20240110_01",
      "v20240210_01",
    ]);
  });

  it("該当件数は最初のページのものを返す", async () => {
    const { impl } = fakeFetch([page1, page2]);
    const client = new AmivoiceClient({ fetchImpl: impl, sleep: noSleep });
    expect((await client.searchMinutes({})).hitCount).toBe(45);
  });

  it("開催日の古い順に並べる", async () => {
    const { impl } = fakeFetch([page1, page2]);
    const client = new AmivoiceClient({ fetchImpl: impl, sleep: noSleep });
    const dates = (await client.searchMinutes({})).hits.map((h) => h.date);
    expect(dates).toEqual([...dates].sort());
  });

  it("maxPages でページ数を制限できる", async () => {
    const { impl, bodies } = fakeFetch([page1, page1, page1]);
    const client = new AmivoiceClient({ fetchImpl: impl, sleep: noSleep });
    await client.searchMinutes({ maxPages: 2 });
    expect(bodies).toHaveLength(2);
  });

  it("新規が増えなくなったら打ち切る（無限ループにしない）", async () => {
    // 同じページを返し続けるサーバでも止まること
    const { impl, bodies } = fakeFetch([page1, page1]);
    const client = new AmivoiceClient({ fetchImpl: impl, sleep: noSleep });
    const result = await client.searchMinutes({});
    expect(bodies.length).toBeLessThanOrEqual(2);
    expect(result.hits).toHaveLength(2);
  });

  it("次ページが無ければ1回で終える", async () => {
    const { impl, bodies } = fakeFetch([page2]);
    const client = new AmivoiceClient({ fetchImpl: impl, sleep: noSleep });
    await client.searchMinutes({});
    expect(bodies).toHaveLength(1);
  });

  it("完全取得を要求した場合は公式件数との不一致を失敗にする", async () => {
    const { impl } = fakeFetch([page2]);
    const client = new AmivoiceClient({ fetchImpl: impl, sleep: noSleep });
    await expect(
      client.searchMinutes({ requireComplete: true })
    ).rejects.toThrow(/公式45件 \/ 取得1件/);
  });
});

describe("会議記録IDの拡張子", () => {
  it("拡張子なしのIDでも本文を取りに行ける", async () => {
    // 検索結果は v20260518_01 のように拡張子なしで返るが、
    // 本文取得には .vcsv が要る。付け忘れると本文が0字で返り、
    // エラーにならないまま取り込みが空振りする
    const { impl, bodies } = fakeFetch([
      '<div class="sub2"><b>○委員長</b><br>本文</div>',
    ]);
    const urls: string[] = [];
    const spy = vi.fn(async (url: string) => {
      urls.push(url);
      return {
        ok: true,
        status: 200,
        text: async () => '<div class="sub2"><b>○委員長</b><br>本文</div>',
      } as Response;
    });
    void impl;
    void bodies;

    const client = new AmivoiceClient({
      fetchImpl: spy as unknown as typeof globalThis.fetch,
      sleep: noSleep,
    });
    await client.getMinutesText("v20260518_01");
    expect(urls[0]).toContain("vcsv=v20260518_01.vcsv");
  });

  it("拡張子付きを渡しても二重に付けない", async () => {
    const urls: string[] = [];
    const spy = vi.fn(async (url: string) => {
      urls.push(url);
      return { ok: true, status: 200, text: async () => "" } as Response;
    });
    const client = new AmivoiceClient({
      fetchImpl: spy as unknown as typeof globalThis.fetch,
      sleep: noSleep,
    });
    await client.getMinutesText("v20260518_01.vcsv");
    expect(urls[0]).toContain("vcsv=v20260518_01.vcsv");
    expect(urls[0]).not.toContain(".vcsv.vcsv");
  });
});
