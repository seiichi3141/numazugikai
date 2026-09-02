"use client";

import {
  type BillsListParams,
  billsListHref,
} from "../../../shared/utils/parse-bills-list-params";
import {
  BILL_SORT_KEYS,
  BILL_SORT_LABELS,
  isBillSortKey,
} from "../../../shared/utils/sort-bills";
import { BillsListSelect } from "./bills-list-select";

/** 並び替えのセレクト。 */
export function BillsSortSelect({ params }: { params: BillsListParams }) {
  return (
    <BillsListSelect
      label="並び替え"
      value={params.sort}
      options={BILL_SORT_KEYS.map((key) => ({
        value: key,
        label: BILL_SORT_LABELS[key],
      }))}
      toHref={(next) =>
        isBillSortKey(next) ? billsListHref(params, { sort: next }) : null
      }
      className="ml-auto"
    />
  );
}
