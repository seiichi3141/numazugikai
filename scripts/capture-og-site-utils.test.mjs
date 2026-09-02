import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateTargetUrl } from "./capture-og-site-utils.mjs";

describe("validateTargetUrl", () => {
  it("HTTP と HTTPS の URL を正規化する", () => {
    assert.equal(validateTargetUrl("https://example.com"), "https://example.com/");
    assert.equal(validateTargetUrl("http://localhost:3000"), "http://localhost:3000/");
  });

  it("HTTP(S) 以外の scheme を拒否する", () => {
    assert.throws(
      () => validateTargetUrl("file:///tmp/page.html"),
      /must use http or https/
    );
  });

  it("不正な URL を拒否する", () => {
    assert.throws(() => validateTargetUrl("not a url"), TypeError);
  });
});
