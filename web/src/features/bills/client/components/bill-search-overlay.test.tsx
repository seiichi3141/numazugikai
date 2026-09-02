// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BillSearchOverlay } from "./bill-search-overlay";

const pushMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

const tags = [
  { id: "kurashi", label: "暮らし", count: 8 },
  { id: "zeikin", label: "税金", count: 3 },
];

const bills = [
  {
    id: "bill-gasoline",
    name: "沼津市国民健康保険税条例の一部を改正する条例",
    bill_content: { title: "保険料の負担を軽くする" },
    tags: [{ id: "zeikin", label: "税金" }],
  },
  {
    id: "bill-school",
    name: "沼津市立学校給食共同調理場条例の一部を改正する条例",
    bill_content: { title: "学校給食費を無償にする" },
    tags: [{ id: "kurashi", label: "暮らし" }],
  },
];

async function open() {
  const user = userEvent.setup();
  render(<BillSearchOverlay tags={tags} bills={bills} />);
  await user.click(screen.getByRole("button", { name: /議案を検索する/ }));
  return user;
}

/** 候補のリンクはタイトルが一致箇所で割れるので、リンク先で特定する。 */
function linkTo(href: string) {
  return screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("href") === href);
}

/** push された遷移先のクエリを読む。エンコード済みの文字列とは比べない。 */
function pushedParam(name: string) {
  const href = pushMock.mock.calls.at(-1)?.[0] as string;
  return new URL(href, "http://localhost").searchParams.get(name);
}

beforeEach(() => {
  pushMock.mockClear();
});

describe("BillSearchOverlay", () => {
  it("入力前は候補を出さず、テーマだけを見せる", async () => {
    await open();

    expect(screen.getByText("テーマから探す")).toBeInTheDocument();
    expect(screen.queryByText(/議案\s*\d+件/)).not.toBeInTheDocument();
  });

  /*
    タイトルがあるだけでは読み上げに使われない。説明が欠けると Radix が警告を
    出すが警告は素通りするので、ここで固定する。
  */
  it("読み上げ向けの説明を持つ", async () => {
    await open();

    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(
      "キーワードやテーマから議案を探せます。"
    );
  });

  it("入力すると一致した候補と件数を出す", async () => {
    const user = await open();

    await user.type(screen.getByRole("searchbox"), "負担");

    expect(screen.getByText(/議案\s*1件/)).toBeInTheDocument();

    const links = linkTo("/bills/bill-gasoline");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent("保険料の負担を軽くする");
  });

  // 候補は名称・タイトル・タグ名だけを見る。要約は渡していない。
  it("タグ名でも候補に出る", async () => {
    const user = await open();

    await user.type(screen.getByRole("searchbox"), "暮らし");

    expect(linkTo("/bills/bill-school")).toHaveLength(1);
  });

  // 一覧の検索は要約も見るので、候補が空でも結果が出ることがある。
  it("一致しなければ候補が無いことを伝える", async () => {
    const user = await open();

    await user.type(screen.getByRole("searchbox"), "宇宙");

    expect(
      screen.getByText(/「宇宙」に一致する候補はありません/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/議案\s*\d+件/)).not.toBeInTheDocument();
  });

  it("送信すると前後の空白を落として一覧へ渡す", async () => {
    const user = await open();

    await user.type(screen.getByRole("searchbox"), "  負担  ");
    await user.click(screen.getByRole("button", { name: "検索" }));

    expect(pushedParam("q")).toBe("負担");
  });

  it("送信するとモーダルを閉じる", async () => {
    const user = await open();

    await user.type(screen.getByRole("searchbox"), "負担");
    await user.click(screen.getByRole("button", { name: "検索" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  // 遷移先が同じ一覧ページのときもあるので、開いたままだと中身が隠れる。
  it("候補を選ぶとモーダルを閉じる", async () => {
    const user = await open();

    await user.type(screen.getByRole("searchbox"), "負担");
    await user.click(linkTo("/bills/bill-gasoline")[0]);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("テーマのチップは一覧をタグで絞ったURLに向き、選ぶと閉じる", async () => {
    const user = await open();
    const chip = screen.getByRole("link", { name: /暮らし/ });

    expect(chip).toHaveAttribute("href", "/bills?tag=kurashi");

    await user.click(chip);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("閉じるボタンでモーダルを閉じる", async () => {
    const user = await open();

    await user.click(screen.getByRole("button", { name: "閉じる" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
