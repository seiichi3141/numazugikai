export function parseFiscalDataPage(
  value: string | string[] | undefined
): number {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}
