/**
 * 議案番号（例: 議第58号）。
 *
 * 沼津市議会が公開する議案書や審議結果は議案番号で並んでいるため、カードに
 * 出しておくと公式資料と突き合わせられる。番号は取り込み時に拾えないことが
 * あるので、無いときは何も出さない。
 */
export function BillNumberLabel({
  billNumber,
}: {
  billNumber: string | null | undefined;
}) {
  if (!billNumber) return null;

  return (
    <span className="text-xs font-medium text-mirai-text-muted">
      {billNumber}
    </span>
  );
}
