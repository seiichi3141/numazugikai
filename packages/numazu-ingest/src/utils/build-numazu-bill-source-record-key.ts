import { buildSourceRecordKey } from "@mirai-gikai/council-ingest-core/source-record-key";
import type {
  CouncilDocumentKind,
  CouncilSubmitterKind,
} from "@mirai-gikai/council-ingest-core/types";
import type { BillNumberKind, BillSubmitter } from "../shared/types";

export type BuildNumazuBillSourceRecordKeyInput = Readonly<{
  sessionSlug: string;
  numberKind: BillNumberKind;
  numberValue: number;
  submitter: BillSubmitter | null;
}>;

function resolveSubmitterKind(
  numberKind: BillNumberKind,
  submitter: BillSubmitter | null
): Exclude<CouncilSubmitterKind, "unknown"> | null {
  if (submitter !== null) return submitter;
  if (numberKind === "hatsugi") return "member";
  if (numberKind === "seigan" || numberKind === "chinjo") return "citizen";
  return null;
}

function resolveDocumentKind(
  numberKind: BillNumberKind,
  submitterKind: Exclude<CouncilSubmitterKind, "unknown">
): CouncilDocumentKind {
  if (numberKind === "hou") return "report";
  if (numberKind === "seigan" || numberKind === "chinjo") return "petition";
  if (submitterKind === "committee") return "committee_bill";
  if (numberKind === "hatsugi" || submitterKind === "member") {
    return "member_bill";
  }
  return "executive_bill";
}

/** 既存Numazu議案を新しい自治体共通keyへ決定的に写像する。 */
export function buildNumazuBillSourceRecordKey(
  input: BuildNumazuBillSourceRecordKeyInput
): string | null {
  if (!/^\d{4}-\d+$/.test(input.sessionSlug)) {
    throw new Error(
      "sessionSlug must use the Numazu YYYY-sessionNumber format"
    );
  }
  if (!Number.isSafeInteger(input.numberValue) || input.numberValue < 0) {
    throw new Error("numberValue must be a non-negative safe integer");
  }

  const submitterKind = resolveSubmitterKind(input.numberKind, input.submitter);
  if (submitterKind === null) return null;

  return buildSourceRecordKey({
    siteKey: "numazu-city",
    sessionKey: input.sessionSlug,
    documentKind: resolveDocumentKind(input.numberKind, submitterKind),
    submitterKind,
    identity: {
      kind: "numbered",
      normalizedNumber: `${input.numberKind}-${input.numberValue}`,
    },
  });
}
