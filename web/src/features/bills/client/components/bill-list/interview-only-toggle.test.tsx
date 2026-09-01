// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Route } from "next";
import { beforeEach, describe, expect, it, vi } from "vitest";

// 遷移先だけを確かめる。next/navigation はテスト環境で動かない
const pushed: string[] = [];
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: (href: string) => pushed.push(href) }),
}));

import { InterviewOnlyToggle } from "./interview-only-toggle";

const on = "/bills?interview=1" as Route;
const off = "/bills" as Route;

describe("InterviewOnlyToggle", () => {
  beforeEach(() => {
    pushed.length = 0;
  });

  it("ラベルを出す", () => {
    render(<InterviewOnlyToggle href={on} checked={false} />);

    expect(
      screen.getByText("AIインタビュー受付中のみ表示")
    ).toBeInTheDocument();
  });

  it("選択状態を支援技術に伝える", () => {
    const { rerender } = render(
      <InterviewOnlyToggle href={on} checked={false} />
    );
    expect(screen.getByRole("checkbox")).not.toBeChecked();

    rerender(<InterviewOnlyToggle href={off} checked />);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("チェックの印は支援技術から隠す", () => {
    // 状態は aria から伝わるので、印を二重に読ませない
    const { container } = render(<InterviewOnlyToggle href={off} checked />);

    expect(container.querySelector("[aria-hidden]")).toBeInTheDocument();
  });

  describe("キーボードとタップ", () => {
    it("本物のチェックボックスにする", () => {
      // role を当てただけのリンクだと Space が効かず、ブラウザ既定の
      // スクロールに落ちて画面が飛ぶ。無反応より分かりにくい
      render(<InterviewOnlyToggle href={on} checked={false} />);

      expect(screen.getByRole("checkbox").tagName).toBe("INPUT");
      expect(screen.getByRole("checkbox")).toHaveAttribute("type", "checkbox");
    });

    it("ラベルから操作できる", () => {
      // ラベルを関連付けると、文字をタップしても切り替わり、
      // タップ領域が文字の分だけ広がる
      render(<InterviewOnlyToggle href={on} checked={false} />);

      expect(
        screen.getByRole("checkbox", { name: "AIインタビュー受付中のみ表示" })
      ).toBeInTheDocument();
    });

    it("切り替えると絞り込み後のURLへ移動する", () => {
      render(<InterviewOnlyToggle href={on} checked={false} />);
      fireEvent.click(screen.getByRole("checkbox"));

      expect(pushed).toEqual([on]);
    });

    it("オンから切り替えると絞り込みを外したURLへ移動する", () => {
      render(<InterviewOnlyToggle href={off} checked />);
      fireEvent.click(screen.getByRole("checkbox"));

      expect(pushed).toEqual([off]);
    });
  });
});
