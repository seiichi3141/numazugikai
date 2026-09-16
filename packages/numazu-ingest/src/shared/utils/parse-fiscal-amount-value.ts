export type FiscalSourceUnit =
  | "yen"
  | "thousand_yen"
  | "ten_thousand_yen"
  | "million_yen"
  | "hundred_million_yen";

const UNIT_MULTIPLIERS: Record<FiscalSourceUnit, bigint> = {
  yen: 1n,
  thousand_yen: 1_000n,
  ten_thousand_yen: 10_000n,
  million_yen: 1_000_000n,
  hundred_million_yen: 100_000_000n,
};

export function parseFiscalInteger(value: string): bigint | null {
  const normalized = value.trim();
  const sign = /^[△▲-]/.test(normalized) ? -1n : 1n;
  const unsigned = normalized.replace(/^[△▲-]/, "");
  if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)$/.test(unsigned)) return null;
  return sign * BigInt(unsigned.replaceAll(",", ""));
}

export function convertFiscalAmountToYen(
  sourceValue: string,
  sourceUnit: FiscalSourceUnit
): bigint | null {
  const parsed = parseFiscalInteger(sourceValue);
  return parsed === null ? null : parsed * UNIT_MULTIPLIERS[sourceUnit];
}

export function parseJapaneseAmountToYen(value: string): bigint | null {
  const normalized = value.replace(/[\s,]/g, "");
  const matched = normalized.match(
    /^([△▲-])?(?:(\d+)億)?(?:(\d+)万)?(?:(\d+)千)?(?:(\d+))?円$/
  );
  if (!matched || matched.slice(2).every((part) => part === undefined)) {
    return null;
  }
  const amount =
    BigInt(matched[2] ?? 0) * 100_000_000n +
    BigInt(matched[3] ?? 0) * 10_000n +
    BigInt(matched[4] ?? 0) * 1_000n +
    BigInt(matched[5] ?? 0);
  return matched[1] ? -amount : amount;
}

export function calculateRoundedPercent(
  numerator: bigint,
  denominator: bigint,
  decimalPlaces: number
): string | null {
  if (numerator < 0n || denominator <= 0n || decimalPlaces < 0) return null;
  const scale = 10n ** BigInt(decimalPlaces);
  const scaledPercent =
    (numerator * 100n * scale * 2n + denominator) / (denominator * 2n);
  const integerPart = scaledPercent / scale;
  if (decimalPlaces === 0) return integerPart.toString();
  return `${integerPart}.${(scaledPercent % scale)
    .toString()
    .padStart(decimalPlaces, "0")}`;
}
