import { describe, expect, it } from "vitest";
import { parseFiscalDataPage } from "./parse-fiscal-data-page";

describe("parseFiscalDataPage", () => {
  it.each([
    ["2", 2],
    [["3", "4"], 3],
    [undefined, 1],
    ["0", 1],
    ["1.5", 1],
    ["invalid", 1],
  ])("%jをページ番号%dとして扱う", (value, expected) => {
    expect(parseFiscalDataPage(value)).toBe(expected);
  });
});
