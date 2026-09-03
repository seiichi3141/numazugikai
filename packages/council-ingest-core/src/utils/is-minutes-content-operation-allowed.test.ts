import { describe, expect, it } from "vitest";
import type { CouncilIngestCapabilities } from "../shared/types";
import { isMinutesContentOperationAllowed } from "./is-minutes-content-operation-allowed";

const capabilities = {
  minutesMetadataLinks: "allowed",
  minutesContent: {
    store_body: "allowed",
    full_text_search: "blocked",
    ai_processing: "blocked",
  },
} as const satisfies CouncilIngestCapabilities;

describe("isMinutesContentOperationAllowed", () => {
  it("明示的にallowedの操作だけを許可する", () => {
    expect(isMinutesContentOperationAllowed(capabilities, "store_body")).toBe(
      true
    );
    expect(
      isMinutesContentOperationAllowed(capabilities, "full_text_search")
    ).toBe(false);
    expect(
      isMinutesContentOperationAllowed(capabilities, "ai_processing")
    ).toBe(false);
  });
});
