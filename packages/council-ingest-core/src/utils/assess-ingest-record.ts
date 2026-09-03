import type { CouncilIngestRecord, SourceReviewStatus } from "../shared/types";
import {
  assessSourceObservations,
  type SourceObservationReviewIssue,
} from "./assess-source-observations";
import { buildSourceRecordKey } from "./build-source-record-key";

export type IngestRecordReviewIssue =
  | SourceObservationReviewIssue
  | "unknown_vote_position"
  | "unknown_submitter"
  | "record_source_key_mismatch"
  | "record_site_key_mismatch"
  | "record_display_number_mismatch"
  | "record_title_mismatch"
  | "record_decided_on_mismatch"
  | "record_decision_mismatch"
  | "record_agreement_mismatch"
  | "record_raw_result_mismatch"
  | "record_identity_mismatch"
  | "record_source_key_invalid";

export type IngestRecordAssessment = Readonly<{
  reviewStatus: SourceReviewStatus;
  sourceConflict: boolean;
  issues: readonly IngestRecordReviewIssue[];
}>;

/** 正規化結果と投票位置をまとめて評価し、未解釈値の公開を防ぐ。 */
export function assessIngestRecord(
  record: CouncilIngestRecord
): IngestRecordAssessment {
  const observationAssessment = assessSourceObservations(record.observations);
  const issues: IngestRecordReviewIssue[] = [...observationAssessment.issues];

  if (record.submitterKind === "unknown") {
    issues.push("unknown_submitter");
  }
  const normalizedNumbers = record.observations.map(
    (observation) => observation.normalized.normalizedNumber
  );
  const identity = record.identity;
  const identityMatches =
    identity.kind === "numbered"
      ? normalizedNumbers.every(
          (number) => number === identity.normalizedNumber
        )
      : normalizedNumbers.every((number) => number === null);
  if (!identityMatches) {
    issues.push("record_identity_mismatch");
  }

  let sourceRecordKeyIsValid: boolean | null = null;
  if (record.submitterKind !== "unknown") {
    try {
      if (record.identity.kind === "numbered") {
        sourceRecordKeyIsValid =
          record.sourceRecordKey ===
          buildSourceRecordKey({
            siteKey: record.siteKey,
            sessionKey: record.sessionKey,
            documentKind: record.documentKind,
            submitterKind: record.submitterKind,
            identity: record.identity,
          });
      } else {
        const stableId = record.identity.stableId.trim();
        sourceRecordKeyIsValid =
          stableId.length > 0 &&
          record.sourceRecordKey.endsWith(
            `:stable:${encodeURIComponent(stableId)}`
          );
      }
    } catch {
      sourceRecordKeyIsValid = false;
    }
  }
  if (sourceRecordKeyIsValid === false) {
    issues.push("record_source_key_invalid");
  }
  if (
    record.observations.some(
      (observation) => observation.sourceRecordKey !== record.sourceRecordKey
    )
  ) {
    issues.push("record_source_key_mismatch");
  }
  if (
    record.observations.some(
      (observation) => observation.provenance.siteKey !== record.siteKey
    )
  ) {
    issues.push("record_site_key_mismatch");
  }
  if (
    record.observations.some(
      (observation) =>
        observation.normalized.displayNumber !== record.displayNumber
    )
  ) {
    issues.push("record_display_number_mismatch");
  }
  if (
    record.observations.some(
      (observation) => observation.normalized.title !== record.title
    )
  ) {
    issues.push("record_title_mismatch");
  }
  if (
    record.observations.some(
      (observation) => observation.normalized.decidedOn !== record.decidedOn
    )
  ) {
    issues.push("record_decided_on_mismatch");
  }
  const resultObservations = record.observations.filter(
    (observation) =>
      observation.rawResult !== null && observation.rawResult.trim().length > 0
  );
  if (
    resultObservations.some(
      (observation) =>
        observation.normalized.result.decision !== record.result.decision
    )
  ) {
    issues.push("record_decision_mismatch");
  }
  if (
    resultObservations.some(
      (observation) =>
        observation.normalized.result.agreement !== record.result.agreement
    )
  ) {
    issues.push("record_agreement_mismatch");
  }
  if (
    resultObservations.length > 0 &&
    !resultObservations.some(
      (observation) => observation.rawResult === record.result.rawResult
    )
  ) {
    issues.push("record_raw_result_mismatch");
  }

  if (record.votes.some((vote) => vote.position === "unknown")) {
    issues.push("unknown_vote_position");
  }

  return {
    reviewStatus: observationAssessment.sourceConflict
      ? "source_conflict"
      : issues.length > 0
        ? "needs_review"
        : "ready",
    sourceConflict: observationAssessment.sourceConflict,
    issues,
  };
}
