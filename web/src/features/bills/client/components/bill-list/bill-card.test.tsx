// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  createMockBill,
  createMockBillContent,
} from "@/app/dev/_lib/mock-data";
import { thumbnailSrc } from "@/test-utils/thumbnail-src";
import { BillCard } from "./bill-card";

describe("BillCard", () => {
  it("タイトルと概要を出す", () => {
    render(
      <BillCard
        bill={createMockBill({
          bill_content: createMockBillContent({
            title: "国民健康保険税を引き下げる",
            summary: "国民健康保険税の税率を引き下げる条例改正です。",
          }),
        })}
      />
    );

    expect(screen.getByText("国民健康保険税を引き下げる")).toBeInTheDocument();
    expect(
      screen.getByText("国民健康保険税の税率を引き下げる条例改正です。")
    ).toBeInTheDocument();
  });

  it("注目の議案にだけ注目バッジを出す", () => {
    const { rerender } = render(
      <BillCard bill={createMockBill({ is_featured: false })} />
    );
    expect(screen.queryByText(/注目/)).not.toBeInTheDocument();

    rerender(<BillCard bill={createMockBill({ is_featured: true })} />);
    expect(screen.getByText(/注目/)).toBeInTheDocument();
  });

  // 沼津版は議案ごとの写真を用意しないので、ほぼ全件がこの経路で表示される。
  it("サムネイルが未設定なら分野タグのイラストを装飾として出す", () => {
    const { container } = render(
      <BillCard
        bill={createMockBill({
          name: "沼津市国民健康保険税条例の一部を改正する条例",
          thumbnail_url: null,
          tags: [{ id: "tag-safety", label: "防災・安全" }],
        })}
      />
    );

    expect(thumbnailSrc(container)).toContain(
      "/img/bill-thumbnails/disaster.webp"
    );
    // 見出しが正式名称を読むので、画像には名前を付けない。
    expect(
      screen.queryByRole("img", {
        name: "沼津市国民健康保険税条例の一部を改正する条例",
      })
    ).not.toBeInTheDocument();
  });

  it("アップロード済みのサムネイルはタグより優先し、同じく装飾として出す", () => {
    const { container } = render(
      <BillCard
        bill={createMockBill({
          name: "沼津市国民健康保険税条例の一部を改正する条例",
          thumbnail_url: "https://example.com/thumb.png",
          tags: [{ id: "tag-safety", label: "防災・安全" }],
        })}
      />
    );

    expect(thumbnailSrc(container)).toContain("https://example.com/thumb.png");
    expect(
      screen.queryByRole("img", {
        name: "沼津市国民健康保険税条例の一部を改正する条例",
      })
    ).not.toBeInTheDocument();
  });

  // 注目バッジはサムネイルの上に重ねる。重なり方そのものは目で見て確かめる。
  it("注目バッジとサムネイルを同時に出す", () => {
    const { container } = render(
      <BillCard
        bill={createMockBill({
          is_featured: true,
          thumbnail_url: "https://example.com/thumb.png",
        })}
      />
    );

    expect(screen.getByText(/注目/)).toBeInTheDocument();
    expect(thumbnailSrc(container)).toContain("https://example.com/thumb.png");
  });

  it("紐づくタグをすべて並べる", () => {
    render(
      <BillCard
        bill={createMockBill({
          tags: [
            { id: "zeikin", label: "税金" },
            { id: "kurashi", label: "暮らし" },
          ],
        })}
      />
    );

    expect(screen.getByText("税金")).toBeInTheDocument();
    expect(screen.getByText("暮らし")).toBeInTheDocument();
  });

  it("公開インタビューがあるときだけ受付中を出す", () => {
    const { rerender } = render(
      <BillCard bill={createMockBill({ hasPublicInterview: false })} />
    );
    expect(screen.queryByText("AIインタビュー受付中")).not.toBeInTheDocument();

    rerender(<BillCard bill={createMockBill({ hasPublicInterview: true })} />);
    expect(screen.getByText("AIインタビュー受付中")).toBeInTheDocument();
  });

  it("レビュー完了のときだけ完了バッジを添える", () => {
    const { rerender } = render(
      <BillCard bill={createMockBill({ is_review_completed: false })} />
    );
    expect(
      screen.queryByRole("img", { name: "レビュー完了" })
    ).not.toBeInTheDocument();

    rerender(<BillCard bill={createMockBill({ is_review_completed: true })} />);
    expect(
      screen.getByRole("img", { name: "レビュー完了" })
    ).toBeInTheDocument();
  });

  it("提出日を time 要素で出す", () => {
    const { container } = render(
      <BillCard bill={createMockBill({ submitted_date: "2026-02-03" })} />
    );

    expect(container.querySelector("time")).toHaveTextContent("2026.2.3 提出");
  });

  /*
    日付そのものの有無で見る。文字列で否定すると、同じカードにある
    ステータスバッジの「提出前」「可決」まで拾ってしまう。
  */
  it("提出日が無ければ日付を出さない", () => {
    const { container } = render(
      <BillCard bill={createMockBill({ submitted_date: null })} />
    );

    expect(container.querySelector("time")).not.toBeInTheDocument();
  });
});
