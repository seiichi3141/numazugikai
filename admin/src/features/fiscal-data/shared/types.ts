import type { Database } from "@mirai-gikai/supabase";

export type FiscalSourceKind =
  Database["public"]["Enums"]["fiscal_source_kind_enum"];
export type FiscalImportStatus =
  Database["public"]["Enums"]["fiscal_import_status_enum"];
export type SourceArtifactRetentionState =
  Database["public"]["Enums"]["source_artifact_retention_state_enum"];

export type FiscalImportBatchListItem = {
  id: string;
  sourceTitle: string;
  sourceUrl: string;
  sourceKind: FiscalSourceKind;
  fiscalYear: number | null;
  profileKey: string;
  profileVersion: string;
  parserName: string;
  parserVersion: string;
  status: FiscalImportStatus;
  retentionState: SourceArtifactRetentionState;
  fetchedAt: string;
  finishedAt: string | null;
  discoveredCount: number;
  stagedCount: number;
  hardErrorCount: number;
  warningCount: number;
  pendingCount: number;
  validationMessages: string[];
};

export type FiscalImportBatchPage = {
  items: FiscalImportBatchListItem[];
  page: number;
  totalCount: number;
};
