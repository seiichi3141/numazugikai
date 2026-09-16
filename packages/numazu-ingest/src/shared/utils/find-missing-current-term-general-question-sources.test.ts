import { describe, expect, it } from "vitest";
import { getGeneralQuestionCurrentTermSources } from "../general-question-current-term-sources";
import { findMissingCurrentTermGeneralQuestionSources } from "./find-missing-current-term-general-question-sources";

describe("findMissingCurrentTermGeneralQuestionSources", () => {
  const urls = getGeneralQuestionCurrentTermSources().map(
    (source) => `https://example.com/reports/${source.fileName}`
  );

  it("現行期manifestの欠落ファイルを返す", () => {
    expect(
      findMissingCurrentTermGeneralQuestionSources(25, urls.slice(1))
    ).toEqual([getGeneralQuestionCurrentTermSources()[0].fileName]);
  });

  it("現行期の全ファイルがあれば欠落なしと判定する", () => {
    expect(findMissingCurrentTermGeneralQuestionSources(25, urls)).toEqual([]);
  });

  it("過去期には現行期manifestを適用しない", () => {
    expect(findMissingCurrentTermGeneralQuestionSources(24, [])).toEqual([]);
  });
});
