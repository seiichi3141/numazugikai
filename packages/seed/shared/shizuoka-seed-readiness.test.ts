import { describe, expect, it } from "vitest";
import {
  assertShizuokaSeedReady,
  SHIZUOKA_SEED_BLOCKED_MESSAGE,
} from "./shizuoka-seed-readiness";

describe("assertShizuokaSeedReady", () => {
  it("静岡県用 seed が未実装の間は常に処理を拒否する", () => {
    expect(() => assertShizuokaSeedReady()).toThrow(
      SHIZUOKA_SEED_BLOCKED_MESSAGE
    );
  });
});
