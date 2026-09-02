import { describe, expect, it } from "vitest";
import {
  BILL_THUMBNAIL_SUBJECTS,
  DEFAULT_BILL_THUMBNAIL_SUBJECT,
  isBillThumbnailSubjectKey,
  TAG_DEFAULT_SUBJECTS,
} from "./subjects";

describe("BILL_THUMBNAIL_SUBJECTS", () => {
  it("key が重複せず、ファイル名に使える形になっている", () => {
    const keys = BILL_THUMBNAIL_SUBJECTS.map((subject) => subject.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(key).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
  });

  it("既定の題材とタグごとの題材はすべて一覧に含まれる", () => {
    expect(isBillThumbnailSubjectKey(DEFAULT_BILL_THUMBNAIL_SUBJECT)).toBe(true);
    for (const { key } of TAG_DEFAULT_SUBJECTS) {
      expect(isBillThumbnailSubjectKey(key)).toBe(true);
    }
  });
});

describe("isBillThumbnailSubjectKey", () => {
  it.each([
    ["一覧にある key", "budget", true],
    ["一覧にない文字列", "unknown", false],
    ["文字列以外", null, false],
  ])("%s → %s", (_, value, expected) => {
    expect(isBillThumbnailSubjectKey(value)).toBe(expected);
  });
});
