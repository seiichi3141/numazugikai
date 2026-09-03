import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(
  new URL("./vercel-ignore-build.mjs", import.meta.url)
);

function runIgnoreBuild(branch) {
  return spawnSync(process.execPath, [scriptPath], {
    encoding: "utf8",
    env: {
      ...process.env,
      VERCEL_GIT_COMMIT_REF: branch,
      VERCEL_GIT_REPO_OWNER: "",
      VERCEL_GIT_REPO_SLUG: "",
    },
  });
}

describe("vercel-ignore-build", () => {
  it("自治体別ブランチは沼津市用 Vercel ビルドをスキップする", () => {
    const result = runIgnoreBuild(
      "sites/shizuoka-pref/feat/foundation"
    );

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /site branch/);
  });

  it("既存の通常ブランチは判定不能時にビルドを続行する", () => {
    const result = runIgnoreBuild("feat/example");

    assert.equal(result.status, 1);
    assert.match(result.stdout, /missing VERCEL_GIT_/);
  });
});
