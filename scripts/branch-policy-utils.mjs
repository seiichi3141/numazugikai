const SITE_WORK_KINDS = new Set([
  "feat",
  "fix",
  "hotfix",
  "chore",
  "docs",
  "refactor",
  "test",
]);

function parseSiteWorkBranch(branch) {
  const match = /^sites\/([^/]+)\/([^/]+)\/(.+)$/.exec(branch);
  if (!match || !SITE_WORK_KINDS.has(match[2])) {
    return null;
  }

  return { site: match[1], kind: match[2] };
}

export function isLifecycleBranch(branch) {
  return (
    branch === "develop" ||
    branch === "main" ||
    /^sites\/[^/]+\/(develop|main)$/.test(branch)
  );
}

/**
 * PR の head / base が自治体境界を越えていないか検証する。
 * @returns {string | null} 違反理由。問題がなければ null。
 */
export function getBranchPolicyError(head, base) {
  if (!head || !base) {
    return "PR_HEAD and PR_BASE are required";
  }

  if (base === "main") {
    return head === "develop" || head.startsWith("hotfix/")
      ? null
      : 'Numazu production PRs must use head "develop" or "hotfix/*"';
  }

  if (base === "develop") {
    return head.startsWith("sites/")
      ? "Site branches must not target the Numazu develop branch"
      : null;
  }

  const siteBase = /^sites\/([^/]+)\/(develop|main)$/.exec(base);
  if (!siteBase) {
    return `Unsupported base branch: "${base}"`;
  }

  const [, site, lifecycle] = siteBase;
  const workBranch = parseSiteWorkBranch(head);
  const isRelease = head === `sites/${site}/develop`;
  if (!workBranch && !isRelease) {
    return `Head branch must use an allowed work kind inside "sites/${site}/"`;
  }
  if (workBranch && workBranch.site !== site) {
    return `Head branch must stay inside "sites/${site}/"`;
  }

  if (lifecycle === "main") {
    const isHotfix = workBranch?.kind === "hotfix";
    if (!isRelease && !isHotfix) {
      return `Production PRs for "${site}" must come from its develop or hotfix branch`;
    }
  }

  return null;
}

/**
 * PR 未作成時に branch 名から期待する base branch を決める。
 * lifecycle main 自体は PR head として扱わないため null を返す。
 */
export function getExpectedBaseBranch(branch) {
  if (!branch) {
    return null;
  }

  if (branch === "develop" || branch.startsWith("hotfix/")) {
    return "main";
  }

  if (branch === "main") {
    return null;
  }

  const lifecycle = /^sites\/([^/]+)\/(develop|main)$/.exec(branch);
  if (lifecycle) {
    const [, site, stage] = lifecycle;
    return stage === "develop" ? `sites/${site}/main` : null;
  }

  const siteWork = parseSiteWorkBranch(branch);
  if (siteWork) {
    return siteWork.kind === "hotfix"
      ? `sites/${siteWork.site}/main`
      : `sites/${siteWork.site}/develop`;
  }

  if (branch.startsWith("sites/")) {
    return null;
  }

  return "develop";
}
