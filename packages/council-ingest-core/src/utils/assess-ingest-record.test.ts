import { describe, expect, it } from "vitest";
import type { CouncilIngestRecord } from "../shared/types";
import {
  SYNTHETIC_DUPLICATE_NUMBER_RECORDS,
  SYNTHETIC_NUMBERLESS_CORRECTION,
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

  it("stable identityでもsource record key全体の一致を要求する", () => {
    const base = SYNTHETIC_DUPLICATE_NUMBER_RECORDS[0];
    const invalidSourceRecordKey =
      "wrong-site:wrong-session:opinion:assembly:stable:opinion-001";
    const record = {
      ...base,
      identity: { kind: "stable" as const, stableId: "opinion-001" },
      sourceRecordKey: invalidSourceRecordKey,
      observations: base.observations.map((observation) => ({
        ...observation,
        sourceRecordKey: invalidSourceRecordKey,
        normalized: {
          ...observation.normalized,
          normalizedNumber: null,
        },
      })),
    };

    expect(assessIngestRecord(record)).toEqual({
      reviewStatus: "needs_review",
      sourceConflict: false,
      issues: ["record_source_key_invalid"],
    });
  });

  it("正しいstable identityのsource record keyを受け入れる", () => {
    const base = SYNTHETIC_DUPLICATE_NUMBER_RECORDS[0];
    const fixture = SYNTHETIC_NUMBERLESS_CORRECTION;
    const observation = fixture.before;
    const record = {
      ...base,
      siteKey: observation.provenance.siteKey,
      sessionKey: "2026-02-regular",
      documentKind: "opinion" as const,
      submitterKind: "assembly" as const,
      identity: fixture.identity,
      sourceRecordKey: fixture.sourceRecordKey,
      displayNumber: observation.normalized.displayNumber,
      title: observation.normalized.title,
      decidedOn: observation.normalized.decidedOn,
      result: {
        ...observation.normalized.result,
        rawResult: observation.rawResult,
      },
      observations: [observation],
      votes: [],
    };

    expect(assessIngestRecord(record)).toEqual({
      reviewStatus: "ready",
      sourceConflict: false,
      issues: [],
    });
  });

  it("空のstable identityを公開前レビューへ送る", () => {
    const base = SYNTHETIC_DUPLICATE_NUMBER_RECORDS[0];
    const sourceRecordKey =
      "shizuoka-pref:2026-02-regular:executive_bill:governor:stable:invalid";
    const record = {
      ...base,
      identity: { kind: "stable" as const, stableId: " " },
      sourceRecordKey,
      observations: base.observations.map((observation) => ({
        ...observation,
        sourceRecordKey,
        normalized: {
          ...observation.normalized,
          normalizedNumber: null,
        },
      })),
    };

    expect(assessIngestRecord(record)).toEqual({
      reviewStatus: "needs_review",
      sourceConflict: false,
      issues: ["record_source_key_invalid"],
    });
  });
});
