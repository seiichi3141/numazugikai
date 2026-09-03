type BillFailure = {
  path: string;
  eraYear: number;
  reason: string;
};

/** 定期実行で、対象年の結果PDFを取りこぼしたまま成功扱いにしない。 */
export function assertNoBillFailuresForEraYear(
  result: { failures: readonly BillFailure[] },
  eraYear: number
): void {
  const failures = result.failures.filter(
    (failure) => failure.eraYear === eraYear
  );
  if (failures.length === 0) return;

  throw new Error(
    `当年の議案審議結果を取り込めなかった: ${failures
      .map((failure) => `${failure.path}: ${failure.reason}`)
      .join("; ")}`
  );
}

/** レイアウト変更で全議案を失った結果を成功として確定しない。 */
export function assertGianResultHasBills(
  result: { bills: readonly unknown[] },
  url: string
): void {
  if (result.bills.length === 0) {
    throw new Error(`議案を1件も読み取れなかった: ${url}`);
  }
}
