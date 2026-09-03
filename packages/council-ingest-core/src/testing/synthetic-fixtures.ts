import type {
  CouncilDecision,
  CouncilDocumentKind,
  CouncilIngestCapabilities,
  CouncilIngestRecord,
  CouncilSourceAlias,
  CouncilSourceKind,
  CouncilSourceObservation,
  CouncilSubmitterKind,
  CouncilVotePosition,
  ResolvedCouncilSourceObservation,
  UnresolvedCouncilSourceObservation,
} from "../shared/types";
import { buildSourceRecordKey } from "../utils/build-source-record-key";

const FETCHED_AT = "2026-01-01T00:00:00.000Z";

function makeObservation(input: {
  sourceRecordKey: string;
  sourceKind: CouncilSourceKind;
  sourceUrl: string;
  fingerprint: string;
  rawTitle: string;
  rawResult: string | null;
  decision: CouncilDecision | null;
  decidedOn?: string | null;
  rawNumber?: string | null;
  displayNumber?: string | null;
  normalizedNumber?: string | null;
}): ResolvedCouncilSourceObservation {
  return {
    identityResolution: "resolved",
    sourceRecordKey: input.sourceRecordKey,
    fingerprint: input.fingerprint,
    locator: "synthetic-section:1",
    provenance: {
      siteKey: "shizuoka-pref",
      sourceKind: input.sourceKind,
      sourceUrl: input.sourceUrl,
      sourcePageId: "synthetic-page",
      sourceUpdatedAt: null,
      fetchedAt: FETCHED_AT,
      httpEtag: null,
      httpLastModified: null,
      contentHash: `sha256:${input.fingerprint}`,
      parserVersion: "synthetic-v1",
      charset: input.sourceKind === "html" ? "utf-8" : "binary",
      decodeWarningCount: 0,
    },
    rawSectionLabel: "合成提出区分",
    rawNumber: input.rawNumber === undefined ? "第1号" : input.rawNumber,
    rawTitle: input.rawTitle,
    rawResult: input.rawResult,
    sourceRowIndex: 1,
    sourceDocumentUrl: null,
    normalized: {
      title: input.rawTitle,
      displayNumber:
        input.displayNumber === undefined ? "第1号" : input.displayNumber,
      normalizedNumber:
        input.normalizedNumber === undefined ? "1" : input.normalizedNumber,
      decidedOn: input.decidedOn ?? "2026-01-01",
      result: {
        decision: input.decision,
        agreement: input.decision === null ? null : "unanimous",
      },
    },
  };
}

function makeNumberedRecord(input: {
  documentKind: CouncilDocumentKind;
  submitterKind: Exclude<CouncilSubmitterKind, "unknown">;
  title: string;
}): CouncilIngestRecord {
  const identity = { kind: "numbered" as const, normalizedNumber: "1" };
  const sourceRecordKey = buildSourceRecordKey({
    siteKey: "shizuoka-pref",
    sessionKey: "2026-02-regular",
    documentKind: input.documentKind,
    submitterKind: input.submitterKind,
    identity,
  });
  const observation = makeObservation({
    sourceRecordKey,
    sourceKind: "html",
    sourceUrl: `https://example.invalid/${input.submitterKind}/1`,
    fingerprint: `number-1-${input.submitterKind}`,
    rawTitle: input.title,
    rawResult: "可決・全員一致",
    decision: "passed",
  });

  return {
    siteKey: "shizuoka-pref",
    sessionKey: "2026-02-regular",
    sourceRecordKey,
    identity,
    documentKind: input.documentKind,
    submitterKind: input.submitterKind,
    rawSubmitterLabel: "合成提出区分",
    submitterRoleSnapshot: null,
    displayNumber: "第1号",
    title: input.title,
    category: "other",
    legalBasis: null,
    submittedOn: null,
    decidedOn: "2026-01-01",
    result: {
      ...observation.normalized.result,
      rawResult: observation.rawResult,
    },
    votes: [],
    observations: [observation],
  };
}

/** 同一会期・同一番号を提出区分で区別する最小fixture。 */
export const SYNTHETIC_DUPLICATE_NUMBER_RECORDS = [
  makeNumberedRecord({
    documentKind: "executive_bill",
    submitterKind: "governor",
    title: "合成知事提出議案",
  }),
  makeNumberedRecord({
    documentKind: "member_bill",
    submitterKind: "member",
    title: "合成議員提出議案",
  }),
  makeNumberedRecord({
    documentKind: "committee_bill",
    submitterKind: "committee",
    title: "合成委員会提出議案",
  }),
] satisfies readonly CouncilIngestRecord[];

const numberlessIdentity = {
  kind: "stable" as const,
  stableId: "opinion-synthetic-001",
};
const numberlessSourceRecordKey = buildSourceRecordKey({
  siteKey: "shizuoka-pref",
  sessionKey: "2026-02-regular",
  documentKind: "opinion",
  submitterKind: "assembly",
  identity: numberlessIdentity,
});

const numberlessBefore = makeObservation({
  sourceRecordKey: numberlessSourceRecordKey,
  sourceKind: "html",
  sourceUrl: "https://example.invalid/opinion/before",
  fingerprint: "opinion-before",
  rawTitle: "合成意見書（訂正前）",
  rawResult: "可決・全員一致",
  decision: "passed",
  decidedOn: "2026-01-01",
  rawNumber: null,
  displayNumber: null,
  normalizedNumber: null,
});
const numberlessAfter = makeObservation({
  sourceRecordKey: numberlessSourceRecordKey,
  sourceKind: "html",
  sourceUrl: "https://example.invalid/opinion/after",
  fingerprint: "opinion-after",
  rawTitle: "合成意見書（訂正後）",
  rawResult: "可決・全員一致",
  decision: "passed",
  decidedOn: "2026-01-02",
  rawNumber: null,
  displayNumber: null,
  normalizedNumber: null,
});

/** 件名・議決日訂正後も永続keyを維持する番号なし文書fixture。 */
export const SYNTHETIC_NUMBERLESS_CORRECTION = {
  identity: numberlessIdentity,
  sourceRecordKey: numberlessSourceRecordKey,
  before: numberlessBefore,
  after: numberlessAfter,
  aliases: [
    {
      sourceRecordKey: numberlessSourceRecordKey,
      fingerprint: numberlessBefore.fingerprint,
      locator: numberlessBefore.locator,
      confirmation: "manual",
      confirmedAt: FETCHED_AT,
    },
    {
      sourceRecordKey: numberlessSourceRecordKey,
      fingerprint: numberlessAfter.fingerprint,
      locator: numberlessAfter.locator,
      confirmation: "manual",
      confirmedAt: FETCHED_AT,
    },
  ] satisfies readonly CouncilSourceAlias[],
} as const;

/** 番号なし文書を自動作成せずalias確認へ送る3種類のfixture。 */
export const SYNTHETIC_UNRESOLVED_NUMBERLESS_OBSERVATIONS = [
  {
    ...makeObservation({
      sourceRecordKey: numberlessSourceRecordKey,
      sourceKind: "html",
      sourceUrl: "https://example.invalid/opinion/unknown-fingerprint",
      fingerprint: "opinion-unknown",
      rawTitle: "合成意見書（未知）",
      rawResult: "可決・全員一致",
      decision: "passed",
      rawNumber: null,
      displayNumber: null,
      normalizedNumber: null,
    }),
    identityResolution: "unresolved",
    sourceRecordKey: null,
    identityContext: {
      siteKey: "shizuoka-pref",
      sessionKey: "2026-02-regular",
      documentKind: "opinion",
      submitterKind: "assembly",
    },
    resolutionIssue: "unknown_fingerprint",
    candidateSourceRecordKeys: [],
  },
  {
    ...makeObservation({
      sourceRecordKey: numberlessSourceRecordKey,
      sourceKind: "html",
      sourceUrl: "https://example.invalid/opinion/multiple-candidates",
      fingerprint: "opinion-multiple",
      rawTitle: "合成意見書（複数候補）",
      rawResult: "可決・全員一致",
      decision: "passed",
      rawNumber: null,
      displayNumber: null,
      normalizedNumber: null,
    }),
    identityResolution: "unresolved",
    sourceRecordKey: null,
    identityContext: {
      siteKey: "shizuoka-pref",
      sessionKey: "2026-02-regular",
      documentKind: "opinion",
      submitterKind: "assembly",
    },
    resolutionIssue: "multiple_candidates",
    candidateSourceRecordKeys: [
      numberlessSourceRecordKey,
      "shizuoka-pref:2026-02-regular:opinion:assembly:stable:opinion-synthetic-002",
    ],
  },
  {
    ...makeObservation({
      sourceRecordKey: numberlessSourceRecordKey,
      sourceKind: "html",
      sourceUrl: "https://example.invalid/opinion/alias-collision",
      fingerprint: "opinion-collision",
      rawTitle: "合成意見書（衝突）",
      rawResult: "可決・全員一致",
      decision: "passed",
      rawNumber: null,
      displayNumber: null,
      normalizedNumber: null,
    }),
    identityResolution: "unresolved",
    sourceRecordKey: null,
    identityContext: {
      siteKey: "shizuoka-pref",
      sessionKey: "2026-02-regular",
      documentKind: "opinion",
      submitterKind: "assembly",
    },
    resolutionIssue: "alias_collision",
    candidateSourceRecordKeys: [numberlessSourceRecordKey],
  },
] satisfies readonly UnresolvedCouncilSourceObservation[];

/** HTMLとPDFの議決結果が異なる場合のfixture。 */
export const SYNTHETIC_RESULT_CONFLICT_OBSERVATIONS = [
  makeObservation({
    sourceRecordKey: "synthetic:conflict",
    sourceKind: "html",
    sourceUrl: "https://example.invalid/conflict.html",
    fingerprint: "conflict-html",
    rawTitle: "合成専決処分事件",
    rawResult: "同意・全員一致",
    decision: "consented",
  }),
  makeObservation({
    sourceRecordKey: "synthetic:conflict",
    sourceKind: "pdf",
    sourceUrl: "https://example.invalid/conflict.pdf",
    fingerprint: "conflict-pdf",
    rawTitle: "合成専決処分事件",
    rawResult: "承認・全員一致",
    decision: "approved",
  }),
] satisfies readonly CouncilSourceObservation[];

/** 会派内splitと議員単位の記名投票を共存させるfixture。 */
export const SYNTHETIC_VOTE_POSITIONS = [
  {
    actor: {
      actorType: "faction",
      actorId: null,
      actorNameAtVote: "合成会派",
      factionNameAtVote: "合成会派",
      seatNumberAtVote: null,
    },
    position: "split",
    forCount: 2,
    againstCount: 1,
    votingMethod: "table",
    rawMark: "賛2・反1",
    ballotColor: null,
    sourceUrl: "https://example.invalid/votes/table",
  },
  {
    actor: {
      actorType: "member",
      actorId: null,
      actorNameAtVote: "合成議員A",
      factionNameAtVote: null,
      seatNumberAtVote: 1,
    },
    position: "for",
    forCount: null,
    againstCount: null,
    votingMethod: "recorded_ballot",
    rawMark: "〇",
    ballotColor: "white",
    sourceUrl: "https://example.invalid/votes/recorded",
  },
  {
    actor: {
      actorType: "member",
      actorId: null,
      actorNameAtVote: "合成議員B",
      factionNameAtVote: "合成会派B",
      seatNumberAtVote: 2,
    },
    position: "against",
    forCount: null,
    againstCount: null,
    votingMethod: "recorded_ballot",
    rawMark: "×",
    ballotColor: "blue",
    sourceUrl: "https://example.invalid/votes/recorded",
  },
] satisfies readonly CouncilVotePosition[];

/** 欠席等の既知状態と、空欄由来の未解釈状態を区別するfixture。 */
export const SYNTHETIC_REVIEW_VOTE_POSITIONS = [
  ...(["absent", "excluded", "abstained"] as const).map((position, index) => ({
    actor: {
      actorType: "member" as const,
      actorId: null,
      actorNameAtVote: `合成議員${index + 1}`,
      factionNameAtVote: "合成会派",
      seatNumberAtVote: index + 3,
    },
    position,
    forCount: null,
    againstCount: null,
    votingMethod: "table" as const,
    rawMark: position,
    ballotColor: null,
    sourceUrl: "https://example.invalid/votes/status",
  })),
  {
    actor: {
      actorType: "member",
      actorId: null,
      actorNameAtVote: "合成議員（空欄）",
      factionNameAtVote: null,
      seatNumberAtVote: 6,
    },
    position: "unknown",
    forCount: null,
    againstCount: null,
    votingMethod: "table",
    rawMark: null,
    ballotColor: null,
    sourceUrl: "https://example.invalid/votes/status",
  },
] satisfies readonly CouncilVotePosition[];

/** 許諾確認前は会議録リンク以外を利用しないpolicy fixture。 */
export const SYNTHETIC_METADATA_ONLY_CAPABILITIES = {
  minutesMetadataLinks: "allowed",
  minutesContent: {
    store_body: "blocked",
    full_text_search: "blocked",
    ai_processing: "blocked",
  },
} as const satisfies CouncilIngestCapabilities;
