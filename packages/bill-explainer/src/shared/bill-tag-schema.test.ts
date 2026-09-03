import { describe, expect, it } from "vitest";
import { billTagAssignmentSchema } from "./bill-tag-schema";

describe("billTagAssignmentSchema", () => {
  it("1〜3件のタグを受け入れる", () => {
    expect(
      billTagAssignmentSchema.safeParse({ labels: ["子育て・教育"] }).success
    ).toBe(true);
    expect(
      billTagAssignmentSchema.safeParse({ labels: ["A", "B", "C"] }).success
    ).toBe(true);
  });

  it("空配列と4件以上を拒否する", () => {
    expect(billTagAssignmentSchema.safeParse({ labels: [] }).success).toBe(
      false
    );
    expect(
      billTagAssignmentSchema.safeParse({ labels: ["A", "B", "C", "D"] })
        .success
    ).toBe(false);
  });
});
