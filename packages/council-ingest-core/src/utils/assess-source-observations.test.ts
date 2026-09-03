import { describe, expect, it } from "vitest";
import type { CouncilSourceObservation } from "../shared/types";
import {
  SYNTHETIC_RESULT_CONFLICT_OBSERVATIONS,
  SYNTHETIC_UNRESOLVED_NUMBERLESS_OBSERVATIONS,
} from "../testing/synthetic-fixtures";
import { assessSourceObservations } from "./assess-source-observations";

function withResult(
  decision: CouncilSourceObservation["normalized"]["result"]["decision"],
  agreement: CouncilSourceObservation["normalized"]["result"]["agreement"]
): CouncilSourceObservation {
  const source = SYNTHETIC_RESULT_CONFLICT_OBSERVATIONS[0];
  return {
    ...source,
    rawResult: "合成結果",
    normalized: {
      ...source.normalized,
      result: { decision, agreement },
    },
  };
}

describe("assessSourceObservations", () => {
  it("同じ正規化結果ならreadyにする", () => {
    const observations = [
      withResult("passed", "unanimous"),
      withResult("passed", "unanimous"),
    ];

    expect(assessSourceObservations(observations)).toEqual({
      reviewStatus: "ready",
      sourceConflict: false,
      issues: [],
    });
  });

  it("decision不一致をsource conflictにする", () => {
    expect(
      assessSourceObservations([
        withResult("consented", "unanimous"),
        withResult("approved", "unanimous"),
      ])
    ).toMatchObject({
      reviewStatus: "source_conflict",
      sourceConflict: true,
      issues: ["decision_conflict"],
    });
  });

  it("agreement不一致をsource conflictにする", () => {
    expect(
      assessSourceObservations([
        withResult("passed", "unanimous"),
        withResult("passed", "majority_for"),
      ])
    ).toMatchObject({
      reviewStatus: "source_conflict",
      sourceConflict: true,
      issues: ["agreement_conflict"],
    });
  });

  it.each([
    "unknown",
    "other",
  ] as const)("%s decisionを手動レビューへ送る", (decision) => {
    expect(
      assessSourceObservations([withResult(decision, "unanimous")])
    ).toMatchObject({
      reviewStatus: "needs_review",
      sourceConflict: false,
      issues: ["unsupported_decision"],
    });
  });

  it("unknown agreementを手動レビューへ送る", () => {
    expect(
      assessSourceObservations([withResult("passed", "unknown")])
    ).toMatchObject({
      reviewStatus: "needs_review",
      sourceConflict: false,
      issues: ["unknown_agreement"],
    });
  });

  it("非空のraw結果をdecisionへ正規化できなければ手動レビューへ送る", () => {
    expect(
      assessSourceObservations([withResult(null, "unanimous")])
    ).toMatchObject({
      reviewStatus: "needs_review",
      sourceConflict: false,
      issues: ["unmapped_decision"],
    });
  });

  it("異なるsource record keyの観測値を同一recordとして扱わない", () => {
    const first = withResult("passed", "unanimous");
    const second = {
      ...withResult("rejected", "minority_for"),
      identityResolution: "resolved" as const,
      sourceRecordKey: "different:source-record-key",
    };

    expect(assessSourceObservations([first, second])).toMatchObject({
      reviewStatus: "needs_review",
      sourceConflict: false,
      issues: ["source_record_key_mismatch"],
    });
  });

  it("観測値がなければ手動レビューへ送る", () => {
    expect(assessSourceObservations([])).toEqual({
      reviewStatus: "needs_review",
      sourceConflict: false,
      issues: ["missing_observation"],
    });
  });

  it.each([
    "unknown_fingerprint",
    "multiple_candidates",
    "alias_collision",
  ] as const)("番号なし文書の%sを手動レビューへ送る", (issue) => {
    const observation = SYNTHETIC_UNRESOLVED_NUMBERLESS_OBSERVATIONS.find(
      (candidate) => candidate.resolutionIssue === issue
    );

    if (observation === undefined) {
      throw new Error(`missing synthetic observation for ${issue}`);
    }
    expect(assessSourceObservations([observation])).toEqual({
      reviewStatus: "needs_review",
      sourceConflict: false,
      issues: [issue],
    });
  });

  it("raw結果がない観測値を不一致比較から除外する", () => {
    const missing = withResult(null, null);
    const withoutRaw = {
      ...missing,
      rawResult: null,
      normalized: {
        ...missing.normalized,
        result: { decision: null, agreement: null },
      },
    };

    expect(
      assessSourceObservations([withResult("passed", "unanimous"), withoutRaw])
    ).toEqual({
      reviewStatus: "ready",
      sourceConflict: false,
      issues: [],
    });
  });
});
