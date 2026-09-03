import { describe, expect, it } from "vitest";
import { assessSourceObservations } from "../utils/assess-source-observations";
import { isMinutesContentOperationAllowed } from "../utils/is-minutes-content-operation-allowed";
import {
  SYNTHETIC_DUPLICATE_NUMBER_RECORDS,
  SYNTHETIC_METADATA_ONLY_CAPABILITIES,
  SYNTHETIC_NUMBERLESS_CORRECTION,
  SYNTHETIC_RESULT_CONFLICT_OBSERVATIONS,
  SYNTHETIC_REVIEW_VOTE_POSITIONS,
  SYNTHETIC_UNRESOLVED_NUMBERLESS_OBSERVATIONS,
  SYNTHETIC_VOTE_POSITIONS,
} from "./synthetic-fixtures";

describe("synthetic council ingest fixtures", () => {
  it("同一会期・同一番号の3提出区分を別keyで表せる", () => {
    const keys = SYNTHETIC_DUPLICATE_NUMBER_RECORDS.map(
      (record) => record.sourceRecordKey
    );

    expect(new Set(keys)).toHaveLength(3);
    expect(
      SYNTHETIC_DUPLICATE_NUMBER_RECORDS.map((record) => record.sessionKey)
    ).toEqual(["2026-02-regular", "2026-02-regular", "2026-02-regular"]);
    expect(
      SYNTHETIC_DUPLICATE_NUMBER_RECORDS.map((record) => record.identity)
    ).toEqual([
      { kind: "numbered", normalizedNumber: "1" },
      { kind: "numbered", normalizedNumber: "1" },
      { kind: "numbered", normalizedNumber: "1" },
    ]);
    expect(
      SYNTHETIC_DUPLICATE_NUMBER_RECORDS.map((record) => record.submitterKind)
    ).toEqual(["governor", "member", "committee"]);
  });

  it("番号なし文書の訂正前後を同じ永続keyへaliasできる", () => {
    const fixture = SYNTHETIC_NUMBERLESS_CORRECTION;

    expect(fixture.before.rawTitle).not.toBe(fixture.after.rawTitle);
    expect(fixture.before.rawNumber).toBeNull();
    expect(fixture.after.normalized.normalizedNumber).toBeNull();
    expect(fixture.before.normalized.decidedOn).not.toBe(
      fixture.after.normalized.decidedOn
    );
    expect(fixture.before.sourceRecordKey).toBe(fixture.sourceRecordKey);
    expect(fixture.after.sourceRecordKey).toBe(fixture.sourceRecordKey);
    expect(fixture.aliases).toEqual([
      {
        sourceRecordKey: fixture.sourceRecordKey,
        fingerprint: "opinion-before",
        locator: "synthetic-section:1",
        confirmation: "manual",
        confirmedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        sourceRecordKey: fixture.sourceRecordKey,
        fingerprint: "opinion-after",
        locator: "synthetic-section:1",
        confirmation: "manual",
        confirmedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
  });

  it("番号なし文書の未解決aliasをcanonical recordへ混入させない", () => {
    expect(
      SYNTHETIC_UNRESOLVED_NUMBERLESS_OBSERVATIONS.map((observation) => ({
        sourceRecordKey: observation.sourceRecordKey,
        identityContext: observation.identityContext,
        issue: observation.resolutionIssue,
        candidateCount: observation.candidateSourceRecordKeys.length,
      }))
    ).toEqual([
      {
        sourceRecordKey: null,
        identityContext: {
          siteKey: "shizuoka-pref",
          sessionKey: "2026-02-regular",
          documentKind: "opinion",
          submitterKind: "assembly",
        },
        issue: "unknown_fingerprint",
        candidateCount: 0,
      },
      {
        sourceRecordKey: null,
        identityContext: {
          siteKey: "shizuoka-pref",
          sessionKey: "2026-02-regular",
          documentKind: "opinion",
          submitterKind: "assembly",
        },
        issue: "multiple_candidates",
        candidateCount: 2,
      },
      {
        sourceRecordKey: null,
        identityContext: {
          siteKey: "shizuoka-pref",
          sessionKey: "2026-02-regular",
          documentKind: "opinion",
          submitterKind: "assembly",
        },
        issue: "alias_collision",
        candidateCount: 1,
      },
    ]);
  });

  it("HTMLとPDFの議決結果不一致を公開前conflictにする", () => {
    expect(
      assessSourceObservations(SYNTHETIC_RESULT_CONFLICT_OBSERVATIONS)
    ).toEqual({
      reviewStatus: "source_conflict",
      sourceConflict: true,
      issues: ["decision_conflict"],
    });
  });

  it("会派splitの人数と議員記名投票のsnapshotを保持する", () => {
    expect(SYNTHETIC_VOTE_POSITIONS[0]).toMatchObject({
      actor: {
        actorNameAtVote: "合成会派",
        factionNameAtVote: "合成会派",
      },
      position: "split",
      forCount: 2,
      againstCount: 1,
    });
    expect(SYNTHETIC_VOTE_POSITIONS[1]).toMatchObject({
      actor: {
        actorType: "member",
        actorNameAtVote: "合成議員A",
        factionNameAtVote: null,
        seatNumberAtVote: 1,
      },
      position: "for",
      rawMark: "〇",
      ballotColor: "white",
    });
    expect(SYNTHETIC_VOTE_POSITIONS[2]).toMatchObject({
      actor: {
        actorType: "member",
        actorNameAtVote: "合成議員B",
        factionNameAtVote: "合成会派B",
        seatNumberAtVote: 2,
      },
      position: "against",
      rawMark: "×",
      ballotColor: "blue",
    });
  });

  it("欠席・除斥・棄権と空欄由来のunknown票を区別する", () => {
    expect(
      SYNTHETIC_REVIEW_VOTE_POSITIONS.map((vote) => vote.position)
    ).toEqual(["absent", "excluded", "abstained", "unknown"]);
    expect(SYNTHETIC_REVIEW_VOTE_POSITIONS[3]).toMatchObject({
      position: "unknown",
      rawMark: null,
    });
  });

  it.each([
    "store_body",
    "full_text_search",
    "ai_processing",
  ] as const)("許諾前policyで%sを拒否する", (operation) => {
    expect(
      isMinutesContentOperationAllowed(
        SYNTHETIC_METADATA_ONLY_CAPABILITIES,
        operation
      )
    ).toBe(false);
  });

  it("許諾前policyでも会議録metadata linkは許可する", () => {
    expect(SYNTHETIC_METADATA_ONLY_CAPABILITIES.minutesMetadataLinks).toBe(
      "allowed"
    );
  });
});
