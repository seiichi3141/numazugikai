// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "./theme-toggle";

const setThemeMock = vi.hoisted(() => vi.fn());
const useThemeMock = vi.hoisted(() => vi.fn());

vi.mock("next-themes", () => ({
  useTheme: useThemeMock,
}));

beforeEach(() => {
  setThemeMock.mockClear();
  useThemeMock.mockReturnValue({
    resolvedTheme: "light",
    setTheme: setThemeMock,
  });
});

describe("ThemeToggle", () => {
  it("ライトテーマではダークモードへの切替として表示する", () => {
    render(<ThemeToggle showLabel />);

    expect(screen.getByText("ダークモード")).toBeTruthy();
    expect(
      screen
        .getByRole("switch", { name: "ダークモードに切り替え" })
        .getAttribute("data-state")
    ).toBe("unchecked");
  });

  it("スイッチをオンにするとダークテーマを保存する", () => {
    render(<ThemeToggle />);

    fireEvent.click(
      screen.getByRole("switch", { name: "ダークモードに切り替え" })
    );

    expect(setThemeMock).toHaveBeenCalledWith("dark");
  });

  it("ダークテーマでは解除操作として表示する", () => {
    useThemeMock.mockReturnValue({
      resolvedTheme: "dark",
      setTheme: setThemeMock,
    });

    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("switch", { name: "ダークモードを解除" }));
    expect(setThemeMock).toHaveBeenCalledWith("light");
  });
});
