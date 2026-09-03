import { describe, expect, it } from "vitest";
import { isShizuokaLocalSupabaseUrl } from "./admin-user";

describe("isShizuokaLocalSupabaseUrl", () => {
  it.each([
    "http://127.0.0.1:55421",
    "http://localhost:55421",
    "http://[::1]:55421",
  ])("静岡県版のローカルAPIを許可する: %s", (url) => {
    expect(isShizuokaLocalSupabaseUrl(url)).toBe(true);
  });

  it.each([
    undefined,
    "not-a-url",
    "http://127.0.0.1:54421",
    "https://example.supabase.co",
  ])("別環境または不正なURLを拒否する: %s", (url) => {
    expect(isShizuokaLocalSupabaseUrl(url)).toBe(false);
  });
});
