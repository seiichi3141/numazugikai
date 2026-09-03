import type {
  CouncilDocumentKind,
  CouncilSubmitterKind,
  SourceRecordIdentity,
} from "../shared/types";

export type BuildSourceRecordKeyInput = Readonly<{
  siteKey: string;
  sessionKey: string;
  documentKind: CouncilDocumentKind;
  submitterKind: Exclude<CouncilSubmitterKind, "unknown">;
  identity: SourceRecordIdentity;
}>;

function encodeKeySegment(value: string, name: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`${name} must not be empty`);
  }
  return encodeURIComponent(normalized);
}

/**
 * 自治体・会期・文書区分をまたいで衝突しないsource record keyを組み立てる。
 *
 * 番号なし文書では、件名や議決日ではなく一度割り当てたstableIdを渡す。
 */
export function buildSourceRecordKey(input: BuildSourceRecordKeyInput): string {
  const identityValue =
    input.identity.kind === "numbered"
      ? input.identity.normalizedNumber
      : input.identity.stableId;

  return [
    encodeKeySegment(input.siteKey, "siteKey"),
    encodeKeySegment(input.sessionKey, "sessionKey"),
    encodeKeySegment(input.documentKind, "documentKind"),
    encodeKeySegment(input.submitterKind, "submitterKind"),
    input.identity.kind,
    encodeKeySegment(identityValue, "identity"),
  ].join(":");
}
