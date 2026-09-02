// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_BILLS_LIST_PARAMS } from "../../../shared/utils/parse-bills-list-params";

// 遷移先だけを確かめる。next/navigation はテスト環境で動かない
const pushed: string[] = [];
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: (href: string) => pushed.push(href) }),
}));

import { BillsSessionSelect } from "./bills-session-select";

const options = [
  { value: "", label: "すべての会期", count: 95 },
  { value: "2026-13", label: "令和8年第13回（6月）定例会", count: 30 },
];

describe("BillsSessionSelect", () => {
  beforeEach(() => {
    pushed.length = 0;
  });

  it("選択肢に件数を添えて出し、選択中の会期を選んだ状態にする", () => {
    render(
      <BillsSessionSelect
        params={{ ...DEFAULT_BILLS_LIST_PARAMS, session: "2026-13" }}
        options={options}
      />
    );
    const select = screen.getByRole("combobox", { name: "会期で絞り込む" });
    expect(select).toHaveValue("2026-13");
    expect(
      screen.getByRole("option", { name: "令和8年第13回（6月）定例会（30件）" })
    ).toBeInTheDocument();
  });

  it("会期を選ぶと session を載せた URL に遷移する", () => {
    render(
      <BillsSessionSelect
        params={DEFAULT_BILLS_LIST_PARAMS}
        options={options}
      />
    );
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "2026-13" },
    });
    expect(pushed).toEqual(["/bills?session=2026-13"]);
  });

  it("「すべて」に戻すと session を外す", () => {
    render(
      <BillsSessionSelect
        params={{ ...DEFAULT_BILLS_LIST_PARAMS, session: "2026-13", page: 3 }}
        options={options}
      />
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });
    expect(pushed).toEqual(["/bills"]);
  });
});
