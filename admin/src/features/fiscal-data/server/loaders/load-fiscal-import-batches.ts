import "server-only";

import { findFiscalImportBatches } from "../repositories/fiscal-import-repository";

export function loadFiscalImportBatches(params: {
  page: number;
  pageSize: number;
}) {
  return findFiscalImportBatches(params);
}
