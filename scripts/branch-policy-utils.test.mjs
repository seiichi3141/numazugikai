import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getBranchPolicyError as evaluateBranchPolicy,
  getExpectedBaseBranch,
  isLifecycleBranch,
} from "./branch-policy-utils.mjs";

const BASE_REPOSITORY = "seiichi3141/numazugikai";

function getBranchPolicyError(
  head,
  base,
  headRepository = BASE_REPOSITORY,
  baseRepository = BASE_REPOSITORY
) {
  return evaluateBranchPolicy(head, base, headRepository, baseRepository);
}

describe("isLifecycleBranch", () => {
  it("共有 lifecycle branch を判定する", () => {
    assert.equal(isLifecycleBranch("develop"), true);
    assert.equal(isLifecycleBranch("main"), true);
  });

  it("自治体 lifecycle branch だけを完全一致で判定する", () => {
    assert.equal(isLifecycleBranch("sites/shizuoka-pref/develop"), true);
    assert.equal(isLifecycleBranch("sites/shizuoka-pref/main"), true);
    assert.equal(isLifecycleBranch("sites/numazu-city/develop"), true);
    assert.equal(isLifecycleBranch("sites/numazu-city/main"), true);
    assert.equal(isLifecycleBranch("sites/shizuoka-pref/feat/main"), false);
    assert.equal(isLifecycleBranch("sites/shizuoka-pref/fix/develop"), false);
    assert.equal(isLifecycleBranch("sites/shizuoka-pref/develop/topic"), false);
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

  it("自治体別の fix branch は同じ自治体の develop を返す", () => {
    assert.equal(
      getExpectedBaseBranch("sites/shizuoka-pref/fix/foundation"),
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

  it("main、非許可種別、不完全な自治体 branch は推定しない", () => {
    assert.equal(getExpectedBaseBranch("main"), null);
    assert.equal(getExpectedBaseBranch("sites/shizuoka-pref"), null);
    assert.equal(getExpectedBaseBranch("sites/shizuoka-pref/main"), null);
    for (const kind of ["feat", "chore", "docs", "refactor", "test"]) {
      assert.equal(
        getExpectedBaseBranch(`sites/shizuoka-pref/${kind}/topic`),
        null
      );
    }
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
  it("head と base の指定を必須にする", () => {
    assert.match(getBranchPolicyError("", "develop"), /required/);
    assert.match(getBranchPolicyError("feat/example", ""), /required/);
  });

  it("外部 fork は共有 develop 宛ての通常開発 PR だけを許可する", () => {
    const forkRepository = "contributor/numazugikai";

    assert.equal(
      getBranchPolicyError(
        "feat/example",
        "develop",
        forkRepository,
        BASE_REPOSITORY
      ),
      null
    );

    for (const [head, base] of [
      ["develop", "main"],
      ["develop", "sites/shizuoka-pref/develop"],
      ["sites/shizuoka-pref/develop", "sites/shizuoka-pref/main"],
      ["sites/shizuoka-pref/fix/example", "sites/shizuoka-pref/develop"],
      ["sites/shizuoka-pref/hotfix/example", "sites/shizuoka-pref/main"],
    ]) {
      assert.match(
        getBranchPolicyError(head, base, forkRepository, BASE_REPOSITORY),
        /must originate from the base repository/
      );
    }
  });

  it("lifecycle PR の repository 情報を必須にする", () => {
    for (const [headRepository, baseRepository] of [
      ["", BASE_REPOSITORY],
      [BASE_REPOSITORY, ""],
    ]) {
      assert.match(
        evaluateBranchPolicy(
          "develop",
          "main",
          headRepository,
          baseRepository
        ),
        /PR_HEAD_REPOSITORY and PR_BASE_REPOSITORY are required/
      );
    }
  });

  it("共有 develop には通常開発 branch だけを許可する", () => {
    assert.equal(getBranchPolicyError("feat/example", "develop"), null);
    assert.equal(getBranchPolicyError("fix/example", "develop"), null);

    for (const head of ["main", "hotfix/urgent"]) {
      assert.match(
        getBranchPolicyError(head, "develop"),
        /must target main, not shared develop/
      );
    }

    for (const head of [
      "sites/shizuoka-pref/feat/example",
      "sites/shizuoka-pref/fix/example",
      "sites/shizuoka-pref/hotfix/urgent",
      "sites/shizuoka-pref/develop",
      "sites/shizuoka-pref/main",
    ]) {
      assert.match(getBranchPolicyError(head, "develop"), /must not target/);
    }
  });

  it("共有 develop から各自治体 develop への昇格を許可する", () => {
    for (const site of ["shizuoka-pref", "numazu-city"]) {
      assert.equal(
        getBranchPolicyError("develop", `sites/${site}/develop`),
        null
      );
    }
  });

  it("共有 develop から自治体 main への直接昇格を拒否する", () => {
    assert.match(
      getBranchPolicyError("develop", "sites/shizuoka-pref/main"),
      /must promote through "sites\/shizuoka-pref\/develop"/
    );
  });

  it("同じ自治体の fix から自治体 develop への PR を許可する", () => {
    assert.equal(
      getBranchPolicyError(
        "sites/shizuoka-pref/fix/example",
        "sites/shizuoka-pref/develop"
      ),
      null
    );
  });

  it("自治体 develop への fix 以外の自治体作業 branch を拒否する", () => {
    for (const kind of [
      "feat",
      "hotfix",
      "chore",
      "docs",
      "refactor",
      "test",
    ]) {
      assert.match(
        getBranchPolicyError(
          `sites/shizuoka-pref/${kind}/example`,
          "sites/shizuoka-pref/develop"
        ),
        /shared develop or its fix branch/
      );
    }
  });

  it("異なる自治体間の作業 branch を拒否する", () => {
    assert.match(
      getBranchPolicyError(
        "sites/numazu-city/fix/example",
        "sites/shizuoka-pref/develop"
      ),
      /stay inside/
    );
    assert.match(
      getBranchPolicyError(
        "sites/numazu-city/develop",
        "sites/shizuoka-pref/main"
      ),
      /stay inside/
    );
    assert.match(
      getBranchPolicyError(
        "sites/numazu-city/hotfix/urgent",
        "sites/shizuoka-pref/main"
      ),
      /stay inside/
    );
  });

  it("自治体 develop への lifecycle、未定義種別、共有作業 branch を拒否する", () => {
    for (const head of [
      "sites/shizuoka-pref/develop",
      "sites/shizuoka-pref/main",
      "sites/shizuoka-pref/main/topic",
      "sites/shizuoka-pref/hotfi/topic",
      "feat/example",
      "hotfix/urgent",
    ]) {
      assert.match(
        getBranchPolicyError(head, "sites/shizuoka-pref/develop"),
        /shared develop or its fix branch/
      );
    }
  });

  it("自治体 main への自治体 develop と同じ自治体の hotfix だけを許可する", () => {
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

    for (const kind of [
      "feat",
      "fix",
      "chore",
      "docs",
      "refactor",
      "test",
    ]) {
      assert.match(
        getBranchPolicyError(
          `sites/shizuoka-pref/${kind}/example`,
          "sites/shizuoka-pref/main"
        ),
        /must come from/
      );
    }
    for (const head of [
      "sites/shizuoka-pref/main",
      "feat/example",
      "hotfix/urgent",
    ]) {
      assert.match(
        getBranchPolicyError(head, "sites/shizuoka-pref/main"),
        /must come from/
      );
    }
  });

  it("既存の main へは共有 develop と共有 hotfix だけを許可する", () => {
    assert.equal(getBranchPolicyError("develop", "main"), null);
    assert.equal(getBranchPolicyError("hotfix/urgent", "main"), null);
    assert.match(getBranchPolicyError("feat/example", "main"), /develop/);
    assert.match(
      getBranchPolicyError("sites/shizuoka-pref/develop", "main"),
      /develop/
    );
    assert.match(
      getBranchPolicyError("sites/shizuoka-pref/hotfix/urgent", "main"),
      /develop/
    );
  });

  it("未対応の base branch を拒否する", () => {
    assert.match(
      getBranchPolicyError("feat/example", "release"),
      /Unsupported base branch/
    );
  });
});
