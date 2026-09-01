import { describe, expect, it } from "vitest";
import {
  type BillsListParams,
  buildBillsListQuery,
  parseBillsListParams,
} from "./parse-bills-list-params";

const defaults: BillsListParams = {
  query: "",
  status: "all",
  tagId: null,
  sort: "new",
  interviewOnly: false,
  page: 1,
};

describe("parseBillsListParams", () => {
  it("何も無ければ既定に倒す", () => {
    expect(parseBillsListParams({})).toEqual(defaults);
  });

  it("すべてのパラメータを読む", () => {
    expect(
      parseBillsListParams({
        q: "ガソリン",
        status: "enacted",
        tag: "9f1c2b3a-4d5e-4f60-8a91-b2c3d4e5f607",
        sort: "old",
        interview: "1",
        page: "3",
      })
    ).toEqual({
      query: "ガソリン",
      status: "enacted",
      tagId: "9f1c2b3a-4d5e-4f60-8a91-b2c3d4e5f607",
      sort: "old",
      interviewOnly: true,
      page: 3,
    });
  });

  // URL 直打ちでページを壊せないようにする。
  it("uuid でないタグ id は無視する", () => {
    // DB 側で絞り込むので、uuid でない値を通すと一覧が 500 になる
    expect(parseBillsListParams({ tag: "zeikin" }).tagId).toBeNull();
    expect(
      parseBillsListParams({ tag: "'; drop table bills; --" }).tagId
    ).toBeNull();
  });

  it("不正なステータスと並び順は既定に倒す", () => {
    const parsed = parseBillsListParams({
      status: "introduced",
      sort: "popular",
    });
    expect(parsed.status).toBe("all");
    expect(parsed.sort).toBe("new");
  });

  it("配列で来たら先頭を採る", () => {
    expect(
      parseBillsListParams({ q: ["a", "b"], status: ["enacted", "all"] })
    ).toMatchObject({ query: "a", status: "enacted" });
  });

  it("前後の空白を落とす", () => {
    expect(parseBillsListParams({ q: "  ガソリン  " }).query).toBe("ガソリン");
  });

  it("空文字のタグは「すべて」扱いにする", () => {
    expect(parseBillsListParams({ tag: "   " }).tagId).toBeNull();
  });

  it("interview は 1 のときだけ真", () => {
    expect(parseBillsListParams({ interview: "1" }).interviewOnly).toBe(true);
    expect(parseBillsListParams({ interview: "true" }).interviewOnly).toBe(
      false
    );
    expect(parseBillsListParams({ interview: "0" }).interviewOnly).toBe(false);
  });
});

describe("buildBillsListQuery", () => {
  it("既定だけならクエリを付けない", () => {
    expect(buildBillsListQuery(defaults, {})).toBe("");
  });

  it("既定値はURLに出さない", () => {
    expect(buildBillsListQuery(defaults, { status: "all", sort: "new" })).toBe(
      ""
    );
  });

  it("差し替えた値だけ載せる", () => {
    expect(buildBillsListQuery(defaults, { status: "enacted" })).toBe(
      "?status=enacted"
    );
  });

  it("他の絞り込みを保ったまま1つだけ差し替える", () => {
    const current: BillsListParams = {
      ...defaults,
      query: "税",
      tagId: "9f1c2b3a-4d5e-4f60-8a91-b2c3d4e5f607",
    };

    expect(buildBillsListQuery(current, { status: "rejected" })).toBe(
      "?q=%E7%A8%8E&status=rejected&tag=9f1c2b3a-4d5e-4f60-8a91-b2c3d4e5f607"
    );
  });

  it("インタビュー絞り込みは 1 で載せる", () => {
    expect(buildBillsListQuery(defaults, { interviewOnly: true })).toBe(
      "?interview=1"
    );
  });

  it("タグを外せる", () => {
    const current: BillsListParams = {
      ...defaults,
      tagId: "9f1c2b3a-4d5e-4f60-8a91-b2c3d4e5f607",
    };
    expect(buildBillsListQuery(current, { tagId: null })).toBe("");
  });

  it("parse と往復して同じ状態に戻る", () => {
    const current: BillsListParams = {
      query: "ガソリン",
      status: "enacted",
      tagId: "9f1c2b3a-4d5e-4f60-8a91-b2c3d4e5f607",
      sort: "old",
      interviewOnly: true,
      page: 3,
    };
    const queryString = buildBillsListQuery(current, {});
    const parsed = Object.fromEntries(
      new URLSearchParams(queryString.slice(1))
    );

    expect(parseBillsListParams(parsed)).toEqual(current);
  });

  describe("ページ番号", () => {
    it("page を読む", () => {
      expect(parseBillsListParams({ page: "3" }).page).toBe(3);
    });

    it("1ページ目は URL に出さない", () => {
      expect(buildBillsListQuery(defaults, { page: 1 })).toBe("");
    });

    it("2ページ目以降は URL に出す", () => {
      expect(buildBillsListQuery(defaults, { page: 2 })).toBe("?page=2");
    });

    it.each([
      "0",
      "-1",
      "1.5",
      "abc",
      "",
    ])("不正なページ番号 %o は1に倒す", (value) => {
      // 負の値をそのまま offset にすると DB がエラーを返す
      expect(parseBillsListParams({ page: value }).page).toBe(1);
    });

    it("絞り込みを変えたら1ページ目に戻す", () => {
      const current: BillsListParams = { ...defaults, page: 3 };
      expect(buildBillsListQuery(current, { status: "enacted" })).toBe(
        "?status=enacted"
      );
    });

    it("並び替えを変えても1ページ目に戻す", () => {
      const current: BillsListParams = { ...defaults, page: 3 };
      expect(buildBillsListQuery(current, { sort: "old" })).toBe("?sort=old");
    });

    it("ページ送りは他の絞り込みを保つ", () => {
      const current: BillsListParams = {
        ...defaults,
        query: "予算",
        status: "enacted",
        page: 2,
      };
      const queryString = buildBillsListQuery(current, { page: 3 });
      expect(
        parseBillsListParams(
          Object.fromEntries(new URLSearchParams(queryString.slice(1)))
        )
      ).toEqual({ ...current, page: 3 });
    });
  });
});
