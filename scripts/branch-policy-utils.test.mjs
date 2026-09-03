import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getBranchPolicyError,
  getExpectedBaseBranch,
  isLifecycleBranch,
} from "./branch-policy-utils.mjs";

describe("isLifecycleBranch", () => {
  it("自治体 lifecycle branch だけを完全一致で判定する", () => {
    assert.equal(isLifecycleBranch("sites/shizuoka-pref/develop"), true);
    assert.equal(isLifecycleBranch("sites/shizuoka-pref/main"), true);
    assert.equal(isLifecycleBranch("sites/shizuoka-pref/feat/main"), false);
    assert.equal(isLifecycleBranch("sites/shizuoka-pref/fix/develop"), false);
  });
});

describe("getExpectedBaseBranch", () => {
  it("既存の通常開発 branch は develop を返す", () => {
    assert.equal(getExpectedBaseBranch("feat/example"), "develop");
  });

  it("既存の release と hotfix は main を返す", () => {
    assert.equal(getExpectedBaseBranch("develop"), "main");
    assert.equal(getExpectedBaseBranch("hotfix/urgent"), "main");
  });

  it("自治体別の通常開発 branch は同じ自治体の develop を返す", () => {
    assert.equal(
      getExpectedBaseBranch("sites/shizuoka-pref/feat/foundation"),
      "sites/shizuoka-pref/develop"
    );
  });

  it("自治体別の release と hotfix は同じ自治体の main を返す", () => {
    assert.equal(
      getExpectedBaseBranch("sites/shizuoka-pref/develop"),
      "sites/shizuoka-pref/main"
    );
    assert.equal(
      getExpectedBaseBranch("sites/shizuoka-pref/hotfix/urgent"),
      "sites/shizuoka-pref/main"
    );
  });

  it("main と不完全な自治体 branch は推定しない", () => {
    assert.equal(getExpectedBaseBranch("main"), null);
    assert.equal(getExpectedBaseBranch("sites/shizuoka-pref"), null);
    assert.equal(getExpectedBaseBranch("sites/shizuoka-pref/main"), null);
    assert.equal(
      getExpectedBaseBranch("sites/shizuoka-pref/main/topic"),
      null
    );
    assert.equal(
      getExpectedBaseBranch("sites/shizuoka-pref/hotfi/topic"),
      null
    );
  });
});

describe("getBranchPolicyError", () => {
  it("同じ自治体の feature から develop への PR を許可する", () => {
    assert.equal(
      getBranchPolicyError(
        "sites/shizuoka-pref/feat/foundation",
        "sites/shizuoka-pref/develop"
      ),
      null
    );
  });

  it("異なる自治体間の PR を拒否する", () => {
    assert.match(
      getBranchPolicyError(
        "sites/numazu-city/feat/example",
        "sites/shizuoka-pref/develop"
      ),
      /stay inside/
    );
  });

  it("未定義の作業種別を拒否する", () => {
    assert.match(
      getBranchPolicyError(
        "sites/shizuoka-pref/main/topic",
        "sites/shizuoka-pref/develop"
      ),
      /allowed work kind/
    );
    assert.match(
      getBranchPolicyError(
        "sites/shizuoka-pref/hotfi/topic",
        "sites/shizuoka-pref/develop"
      ),
      /allowed work kind/
    );
  });

  it("自治体 branch から既存の Numazu develop への PR を拒否する", () => {
    assert.match(
      getBranchPolicyError(
        "sites/shizuoka-pref/feat/example",
        "develop"
      ),
      /must not target/
    );
  });

  it("自治体 main への release と hotfix だけを許可する", () => {
    assert.equal(
      getBranchPolicyError(
        "sites/shizuoka-pref/develop",
        "sites/shizuoka-pref/main"
      ),
      null
    );
    assert.equal(
      getBranchPolicyError(
        "sites/shizuoka-pref/hotfix/urgent",
        "sites/shizuoka-pref/main"
      ),
      null
    );
    assert.match(
      getBranchPolicyError(
        "sites/shizuoka-pref/feat/example",
        "sites/shizuoka-pref/main"
      ),
      /must come from/
    );
  });

  it("既存の Numazu main へは develop と hotfix だけを許可する", () => {
    assert.equal(getBranchPolicyError("develop", "main"), null);
    assert.equal(getBranchPolicyError("hotfix/urgent", "main"), null);
    assert.match(getBranchPolicyError("feat/example", "main"), /develop/);
  });
});
