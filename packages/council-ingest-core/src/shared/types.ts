/** 全自治体の取り込みadapterが共通repositoryへ渡す値の契約。 */

export const COUNCIL_BILL_CATEGORIES = [
  "ordinance",
  "budget",
  "settlement",
  "contract",
  "provisional_approval",
  "report",
  "personnel",
  "opinion_paper",
  "petition",
  "other",
] as const;

export type CouncilBillCategory = (typeof COUNCIL_BILL_CATEGORIES)[number];

export const COUNCIL_DECISIONS = [
  "passed",
  "rejected",
  "consented",
  "approved",
  "certified",
  "adopted",
  "not_adopted",
  "continued",
  "withdrawn",
  "reported",
  "other",
  "unknown",
] as const;

export type CouncilDecision = (typeof COUNCIL_DECISIONS)[number];

export const COUNCIL_AGREEMENTS = [
  "unanimous",
  "majority_for",
  "minority_for",
  "unknown",
] as const;

export type CouncilAgreement = (typeof COUNCIL_AGREEMENTS)[number];

export type NormalizedCouncilResult = Readonly<{
  decision: CouncilDecision | null;
  agreement: CouncilAgreement | null;
}>;

export type CouncilResult = NormalizedCouncilResult &
  Readonly<{
    rawResult: string | null;
  }>;

export type CouncilSubmitterKind =
  | "mayor"
  | "governor"
  | "member"
  | "committee"
  | "citizen"
  | "assembly"
  | "unknown";

export type CouncilDocumentKind =
  | "executive_bill"
  | "member_bill"
  | "committee_bill"
  | "petition"
  | "financial_statement"
  | "opinion"
  | "resolution"
  | "report"
  | "other";

export type SourceRecordIdentity =
  | Readonly<{ kind: "numbered"; normalizedNumber: string }>
  | Readonly<{ kind: "stable"; stableId: string }>;

export type CouncilSourceKind =
  | "html"
  | "pdf"
  | "minutes_index"
  | "minutes_document"
  | "other";

export type CouncilSourceProvenance = Readonly<{
  siteKey: string;
  sourceKind: CouncilSourceKind;
  sourceUrl: string;
  sourcePageId: string | null;
  sourceUpdatedAt: string | null;
  fetchedAt: string;
  httpEtag: string | null;
  httpLastModified: string | null;
  contentHash: string;
  parserVersion: string;
  charset: string;
  decodeWarningCount: number;
}>;

export type NormalizedSourceRecord = Readonly<{
  title: string;
  displayNumber: string | null;
  normalizedNumber: string | null;
  decidedOn: string | null;
  result: NormalizedCouncilResult;
}>;

type CouncilSourceObservationBase = Readonly<{
  fingerprint: string;
  locator: string | null;
  provenance: CouncilSourceProvenance;
  rawSectionLabel: string;
  rawNumber: string | null;
  rawTitle: string;
  rawResult: string | null;
  sourceRowIndex: number | null;
  sourceDocumentUrl: string | null;
  normalized: NormalizedSourceRecord;
}>;

export type SourceIdentityResolutionIssue =
  | "unknown_fingerprint"
  | "multiple_candidates"
  | "alias_collision";

export type SourceIdentityContext = Readonly<{
  siteKey: string;
  sessionKey: string;
  documentKind: CouncilDocumentKind;
  submitterKind: CouncilSubmitterKind;
}>;

export type ResolvedCouncilSourceObservation = CouncilSourceObservationBase &
  Readonly<{
    identityResolution: "resolved";
    sourceRecordKey: string;
  }>;

export type UnresolvedCouncilSourceObservation = CouncilSourceObservationBase &
  Readonly<{
    identityResolution: "unresolved";
    sourceRecordKey: null;
    identityContext: SourceIdentityContext;
    resolutionIssue: SourceIdentityResolutionIssue;
    candidateSourceRecordKeys: readonly string[];
  }>;

export type CouncilSourceObservation =
  | ResolvedCouncilSourceObservation
  | UnresolvedCouncilSourceObservation;

export type CouncilSourceAlias = Readonly<{
  sourceRecordKey: string;
  fingerprint: string;
  locator: string | null;
  confirmation: "automatic" | "manual";
  confirmedAt: string;
}>;

export type FactionVoteActor = Readonly<{
  actorType: "faction";
  actorId: string | null;
  actorNameAtVote: string;
  factionNameAtVote: string;
  seatNumberAtVote: null;
}>;

export type MemberVoteActor = Readonly<{
  actorType: "member";
  actorId: string | null;
  actorNameAtVote: string;
  factionNameAtVote: string | null;
  seatNumberAtVote: number | null;
}>;

export type CouncilVoteActor = FactionVoteActor | MemberVoteActor;

export type CouncilVotePositionKind =
  | "for"
  | "against"
  | "split"
  | "absent"
  | "excluded"
  | "abstained"
  | "unknown";

export type CouncilVotingMethod = "table" | "recorded_ballot" | "other";
export type CouncilBallotColor = "white" | "blue" | null;

type CouncilVotePositionBase = Readonly<{
  votingMethod: CouncilVotingMethod;
  rawMark: string | null;
  ballotColor: CouncilBallotColor;
  sourceUrl: string;
}>;

export type CouncilVotePosition =
  | (CouncilVotePositionBase &
      Readonly<{
        actor: FactionVoteActor;
        position: "split";
        forCount: number;
        againstCount: number;
      }>)
  | (CouncilVotePositionBase &
      Readonly<{
        actor: CouncilVoteActor;
        position: Exclude<CouncilVotePositionKind, "split">;
        forCount: null;
        againstCount: null;
      }>);

export type SourceReviewStatus = "ready" | "needs_review" | "source_conflict";

export type CouncilIngestRecord = Readonly<{
  siteKey: string;
  sessionKey: string;
  sourceRecordKey: string;
  identity: SourceRecordIdentity;
  documentKind: CouncilDocumentKind;
  submitterKind: CouncilSubmitterKind;
  rawSubmitterLabel: string | null;
  submitterRoleSnapshot: string | null;
  displayNumber: string | null;
  title: string;
  category: CouncilBillCategory;
  legalBasis: string | null;
  submittedOn: string | null;
  decidedOn: string | null;
  result: CouncilResult;
  votes: readonly CouncilVotePosition[];
  observations: readonly ResolvedCouncilSourceObservation[];
}>;

export const MINUTES_CONTENT_OPERATIONS = [
  "store_body",
  "full_text_search",
  "ai_processing",
] as const;

export type MinutesContentOperation =
  (typeof MINUTES_CONTENT_OPERATIONS)[number];

export type CouncilMinutesContentPolicy = Readonly<
  Record<MinutesContentOperation, "allowed" | "blocked">
>;

export type CouncilIngestCapabilities = Readonly<{
  minutesMetadataLinks: "allowed" | "blocked";
  minutesContent: CouncilMinutesContentPolicy;
}>;
