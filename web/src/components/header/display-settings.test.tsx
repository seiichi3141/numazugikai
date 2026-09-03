// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DisplaySettingsControls,
  DisplaySettingsPopover,
} from "./display-settings";

const useThemeMock = vi.hoisted(() => vi.fn());
const useRubyToggleMock = vi.hoisted(() => vi.fn());
const setThemeMock = vi.hoisted(() => vi.fn());

vi.mock("next-themes", () => ({ useTheme: useThemeMock }));
vi.mock("@/lib/rubyful/use-ruby-toggle", () => ({
  useRubyToggle: useRubyToggleMock,
}));

beforeEach(() => {
  useThemeMock.mockReturnValue({
    resolvedTheme: "light",
    setTheme: setThemeMock,
  });
  useRubyToggleMock.mockReturnValue({
    rubyEnabled: false,
    handleRubyToggle: vi.fn(),
  });
});

describe("DisplaySettings", () => {
  it("2つの表示設定を名前と説明で区別する", () => {
    render(<DisplaySettingsControls />);

    expect(screen.getByText("ふりがな表示")).toBeInTheDocument();
    expect(screen.getByText("漢字の読みを表示")).toBeInTheDocument();
    expect(screen.getByText("ダークモード")).toBeInTheDocument();
    expect(screen.getByText("画面を暗い配色に変更")).toBeInTheDocument();
    expect(screen.getAllByRole("switch")).toHaveLength(2);
    expect(
      screen.getByRole("switch", { name: "ふりがな表示の切り替え" })
    ).toHaveAccessibleDescription("漢字の読みを表示");
    expect(
      screen.getByRole("switch", { name: "ダークモードに切り替え" })
    ).toHaveAccessibleDescription("画面を暗い配色に変更");
  });

  it("デスクトップの表示設定を開いて設定を操作できる", async () => {
    render(<DisplaySettingsPopover />);

    const trigger = screen.getByRole("button", { name: "表示設定を開く" });
    expect(trigger).toHaveClass("xl:flex");
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();

    await userEvent.click(trigger);
    expect(
      screen.getByText("読みやすさと画面の見た目を変更できます")
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("switch", { name: "ダークモードに切り替え" })
    );
    expect(setThemeMock).toHaveBeenCalledWith("dark");
  });
});
