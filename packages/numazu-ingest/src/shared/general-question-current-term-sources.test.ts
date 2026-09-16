import { describe, expect, it } from "vitest";
import { getGeneralQuestionCurrentTermSources } from "./general-question-current-term-sources";

describe("getGeneralQuestionCurrentTermSources", () => {
  it("第25期の公開済み14資料を重複なく保持する", () => {
    const sources = getGeneralQuestionCurrentTermSources();
    expect(sources).toHaveLength(14);
    expect(new Set(sources.map((source) => source.fileName)).size).toBe(14);
    expect(sources.filter((source) => source.sessionNumber === 4)).toHaveLength(
      2
    );
    expect(
      sources.every(
        (source) =>
          source.expectedAppearanceCount > 0 &&
          source.expectedTopLevelItemCount >= source.expectedAppearanceCount
      )
    ).toBe(true);
  });
});
