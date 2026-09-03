import type {
  CouncilIngestCapabilities,
  MinutesContentOperation,
} from "../shared/types";

/** 会議録本文に対する操作を自治体ごとの明示的なpolicyで判定する。 */
export function isMinutesContentOperationAllowed(
  capabilities: CouncilIngestCapabilities,
  operation: MinutesContentOperation
): boolean {
  return capabilities.minutesContent[operation] === "allowed";
}
