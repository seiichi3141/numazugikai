"use client";

import {
  type BillsListParams,
  billsListHref,
} from "../../../shared/utils/parse-bills-list-params";
import type { SessionFilterOption } from "../../../shared/utils/session-filter-options";
import { BillsListSelect } from "./bills-list-select";

/**
 * 「会期」の絞り込み。定例会と臨時会の両方を含む。
 *
 * 会期は数十件あってチップに並べると縦に伸びるので select にする。
 */
export function BillsSessionSelect({
  params,
  options,
}: {
  params: BillsListParams;
  options: SessionFilterOption[];
}) {
  return (
    <BillsListSelect
      label="会期で絞り込む"
      value={params.session ?? ""}
      options={options.map((option) => ({
        value: option.value,
        label: `${option.label}（${option.count}件）`,
      }))}
      toHref={(next) => billsListHref(params, { session: next || null })}
    />
  );
}
