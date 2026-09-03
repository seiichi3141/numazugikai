import { describe, expect, it } from "vitest";
import { buildCouncilWatchUrl } from "./discussvision-client";

describe("buildCouncilWatchUrl", () => {
  it("発言者のない項目にもDiscussVisionが要求するパラメータを付ける", () => {
    expect(buildCouncilWatchUrl("61", "5", "2", null, "2025")).toBe(
      "https://smart.discussvision.net/smart/tenant/numazu/WebView/rd/speech.html?council_id=61&schedule_id=5&playlist_id=2&speaker_id=null&target_year=2025"
    );
  });

  it("発言者がある項目はspeaker_idを保持する", () => {
    const url = new URL(buildCouncilWatchUrl("61", "5", "7", "123", "2025"));

    expect(url.searchParams.get("speaker_id")).toBe("123");
    expect(url.searchParams.get("target_year")).toBe("2025");
  });
});
