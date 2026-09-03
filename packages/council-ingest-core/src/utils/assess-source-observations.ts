import type {
  CouncilAgreement,
  CouncilDecision,
  CouncilSourceObservation,
  SourceIdentityResolutionIssue,
  SourceReviewStatus,
} from "../shared/types";

export type SourceObservationReviewIssue =
  | "missing_observation"
  | "source_record_key_mismatch"
  | SourceIdentityResolutionIssue
  | "unmapped_decision"
  | "unsupported_decision"
  | "unknown_agreement"
  | "decision_conflict"
  | "agreement_conflict";

export type SourceObservationAssessment = Readonly<{
  reviewStatus: SourceReviewStatus;
  sourceConflict: boolean;
  issues: readonly SourceObservationReviewIssue[];
}>;

function collectKnownValues<T>(values: readonly (T | null)[]): Set<T> {
  return new Set(values.filter((value): value is T => value !== null));
}

/** HTMLとPDFなど複数の公式観測値を、上書きせず公開前判定する。 */
export function assessSourceObservations(
  observations: readonly CouncilSourceObservation[]
): SourceObservationAssessment {
  if (observations.length === 0) {
    return {
      reviewStatus: "needs_review",
      sourceConflict: false,
      issues: ["missing_observation"],
    };
  }

  const unresolvedIssues = [
    ...new Set(
      observations.flatMap((observation) =>
        observation.identityResolution === "unresolved"
          ? [observation.resolutionIssue]
          : []
      )
    ),
  ];
  if (unresolvedIssues.length > 0) {
    return {
      reviewStatus: "needs_review",
      sourceConflict: false,
      issues: unresolvedIssues,
    };
  }

  const resolved = observations.filter(
    (observation) => observation.identityResolution === "resolved"
  );

  const sourceRecordKeys = new Set(
    resolved.map((observation) => observation.sourceRecordKey)
  );
  if (sourceRecordKeys.size > 1) {
    return {
      reviewStatus: "needs_review",
      sourceConflict: false,
      issues: ["source_record_key_mismatch"],
    };
  }

  const comparable = resolved.filter(
    (observation) =>
      observation.rawResult !== null && observation.rawResult.trim().length > 0
  );
  const decisions = collectKnownValues<CouncilDecision>(
    comparable.map((observation) => observation.normalized.result.decision)
  );
  const agreements = collectKnownValues<CouncilAgreement>(
    comparable.map((observation) => observation.normalized.result.agreement)
  );
  const issues: SourceObservationReviewIssue[] = [];

  if (
    comparable.some(
      (observation) => observation.normalized.result.decision === null
    )
  ) {
    issues.push("unmapped_decision");
  }
  if (decisions.has("unknown") || decisions.has("other")) {
    issues.push("unsupported_decision");
  }
  if (agreements.has("unknown")) {
    issues.push("unknown_agreement");
  }
  if (decisions.size > 1) {
    issues.push("decision_conflict");
  }
  if (agreements.size > 1) {
    issues.push("agreement_conflict");
  }

  const sourceConflict = issues.some(
    (issue) => issue === "decision_conflict" || issue === "agreement_conflict"
  );

  return {
    reviewStatus: sourceConflict
      ? "source_conflict"
      : issues.length > 0
        ? "needs_review"
        : "ready",
    sourceConflict,
    issues,
  };
}
