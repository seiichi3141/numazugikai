import { describe, expect, it } from "vitest";
import type { CouncilIngestRecord } from "../shared/types";
import {
  SYNTHETIC_DUPLICATE_NUMBER_RECORDS,
  SYNTHETIC_REVIEW_VOTE_POSITIONS,
} from "../testing/synthetic-fixtures";
import { assessIngestRecord } from "./assess-ingest-record";

describe("assessIngestRecord", () => {
  it("既知の欠席・除斥・棄権は公開前レビューを要求しない", () => {
    const record = {
      ...SYNTHETIC_DUPLICATE_NUMBER_RECORDS[0],
      votes: SYNTHETIC_REVIEW_VOTE_POSITIONS.filter(
        (vote) => vote.position !== "unknown"
      ),
    };

    expect(assessIngestRecord(record)).toEqual({
      reviewStatus: "ready",
      sourceConflict: false,
      issues: [],
    });
  });

  it("空欄由来のunknown票を公開前レビューへ送る", () => {
    const record = {
      ...SYNTHETIC_DUPLICATE_NUMBER_RECORDS[0],
      votes: SYNTHETIC_REVIEW_VOTE_POSITIONS,
    };

    expect(assessIngestRecord(record)).toEqual({
      reviewStatus: "needs_review",
      sourceConflict: false,
      issues: ["unknown_vote_position"],
    });
  });

  it("結果欄がない補助観測をcanonical resultの比較から除外する", () => {
    const base = SYNTHETIC_DUPLICATE_NUMBER_RECORDS[0];
    const source = base.observations[0];
    const withoutResult = {
      ...source,
      rawResult: null,
      normalized: {
        ...source.normalized,
        result: { decision: null, agreement: null },
      },
    };

    expect(
      assessIngestRecord({
        ...base,
        observations: [source, withoutResult],
      })
    ).toEqual({
      reviewStatus: "ready",
      sourceConflict: false,
      issues: [],
    });
  });

  it.each([
    [
      "source record key",
      (record: CouncilIngestRecord) => ({
        ...record,
        sourceRecordKey: "different:key",
      }),
      "record_source_key_mismatch",
    ],
    [
      "numbered identity",
      (record: CouncilIngestRecord) => ({
        ...record,
        identity: { kind: "numbered" as const, normalizedNumber: "2" },
      }),
      "record_identity_mismatch",
    ],
    [
      "site key",
      (record: CouncilIngestRecord) => ({
        ...record,
        siteKey: "different-site",
      }),
      "record_site_key_mismatch",
    ],
    [
      "display number",
      (record: CouncilIngestRecord) => ({ ...record, displayNumber: "第2号" }),
      "record_display_number_mismatch",
    ],
    [
      "title",
      (record: CouncilIngestRecord) => ({ ...record, title: "改変件名" }),
      "record_title_mismatch",
    ],
    [
      "decided on",
      (record: CouncilIngestRecord) => ({ ...record, decidedOn: "2026-01-02" }),
      "record_decided_on_mismatch",
    ],
    [
      "decision",
      (record: CouncilIngestRecord) => ({
        ...record,
        result: { ...record.result, decision: "rejected" as const },
      }),
      "record_decision_mismatch",
    ],
    [
      "agreement",
      (record: CouncilIngestRecord) => ({
        ...record,
        result: { ...record.result, agreement: "majority_for" as const },
      }),
      "record_agreement_mismatch",
    ],
    [
      "raw result",
      (record: CouncilIngestRecord) => ({
        ...record,
        result: { ...record.result, rawResult: "改変結果" },
      }),
      "record_raw_result_mismatch",
    ],
  ] as const)("canonical %sの根拠不一致を手動レビューへ送る", (_name, alter, issue) => {
    const assessment = assessIngestRecord(
      alter(SYNTHETIC_DUPLICATE_NUMBER_RECORDS[0])
    );

    expect(assessment.reviewStatus).toBe("needs_review");
    expect(assessment.issues).toContain(issue);
  });

  it("unknown提出区分を手動レビューへ送る", () => {
    const record = {
      ...SYNTHETIC_DUPLICATE_NUMBER_RECORDS[0],
      submitterKind: "unknown" as const,
    };

    expect(assessIngestRecord(record)).toMatchObject({
      reviewStatus: "needs_review",
      issues: ["unknown_submitter"],
    });
  });
});
