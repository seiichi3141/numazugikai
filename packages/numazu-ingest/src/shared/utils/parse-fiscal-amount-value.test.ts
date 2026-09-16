import { describe, expect, it } from "vitest";
import {
  calculateRoundedPercent,
  convertFiscalAmountToYen,
  parseFiscalInteger,
  parseJapaneseAmountToYen,
} from "./parse-fiscal-amount-value";

describe("parseFiscalInteger", () => {
  it("桁区切り、ゼロ、負数を区別して整数化する", () => {
    expect(parseFiscalInteger("92,736,569,118")).toBe(92_736_569_118n);
    expect(parseFiscalInteger("0")).toBe(0n);
    expect(parseFiscalInteger("△3,987")).toBe(-3_987n);
    expect(parseFiscalInteger("12,34")).toBeNull();
    expect(parseFiscalInteger("-")).toBeNull();
  });
});

describe("convertFiscalAmountToYen", () => {
  it("原資料の単位を保ったまま円へ変換する", () => {
    expect(convertFiscalAmountToYen("106,430,416", "thousand_yen")).toBe(
      106_430_416_000n
    );
    expect(convertFiscalAmountToYen("460,162", "thousand_yen")).toBe(
      460_162_000n
    );
  });
});

describe("parseJapaneseAmountToYen", () => {
  it("億・万・千の複合表記を円へ変換する", () => {
    expect(parseJapaneseAmountToYen("927 億 3,656 万 9 千円")).toBe(
      92_736_569_000n
    );
    expect(parseJapaneseAmountToYen("▲ 2 億 4 万円")).toBe(-200_040_000n);
    expect(parseJapaneseAmountToYen("金額なし")).toBeNull();
  });
});

describe("calculateRoundedPercent", () => {
  it("浮動小数点を使わず指定桁へ四捨五入する", () => {
    expect(calculateRoundedPercent(449_516_456n, 464_149_000n, 1)).toBe("96.8");
    expect(calculateRoundedPercent(92_736_569_118n, 106_430_416_000n, 1)).toBe(
      "87.1"
    );
    expect(calculateRoundedPercent(1n, 0n, 1)).toBeNull();
    expect(calculateRoundedPercent(-1n, 10n, 1)).toBeNull();
  });
});
