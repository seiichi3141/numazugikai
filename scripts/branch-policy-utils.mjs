const SITE_ENVIRONMENT_WORK_KINDS = new Set(["fix", "hotfix"]);

function parseSiteEnvironmentWorkBranch(branch) {
  const match = /^sites\/([^/]+)\/([^/]+)\/(.+)$/.exec(branch);
  if (!match || !SITE_ENVIRONMENT_WORK_KINDS.has(match[2])) {
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
export function getBranchPolicyError(
  head,
  base,
  headRepository,
  baseRepository
) {
  if (!head || !base) {
    return "PR_HEAD and PR_BASE are required";
  }

  const targetsLifecycleBranch =
    base === "main" || /^sites\/[^/]+\/(develop|main)$/.test(base);
  if (targetsLifecycleBranch) {
    if (!headRepository || !baseRepository) {
      return "PR_HEAD_REPOSITORY and PR_BASE_REPOSITORY are required for lifecycle PRs";
    }

    if (headRepository !== baseRepository) {
      return `Lifecycle PRs must originate from the base repository "${baseRepository}"`;
    }
  }

  if (base === "main") {
    return head === "develop" || head.startsWith("hotfix/")
      ? null
      : 'Numazu production PRs must use head "develop" or "hotfix/*"';
  }

  if (base === "develop") {
    if (head.startsWith("sites/")) {
      return "Site branches must not target the shared develop branch";
    }

    return head === "main" || head.startsWith("hotfix/")
      ? "Numazu release branches must target main, not shared develop"
      : null;
  }

  const siteBase = /^sites\/([^/]+)\/(develop|main)$/.exec(base);
  if (!siteBase) {
    return `Unsupported base branch: "${base}"`;
  }

  const [, site, lifecycle] = siteBase;
  const workBranch = parseSiteEnvironmentWorkBranch(head);
  const headSite = /^sites\/([^/]+)\//.exec(head)?.[1];
  if (headSite && headSite !== site) {
    return `Head branch must stay inside "sites/${site}/"`;
  }

  if (lifecycle === "develop") {
    if (head === "develop" || workBranch?.kind === "fix") {
      return null;
    }

    return `Development PRs for "${site}" must come from shared develop or its fix branch`;
  }

  if (head === "develop") {
    return `Shared develop must promote through "sites/${site}/develop"`;
  }

  const isRelease = head === `sites/${site}/develop`;
  const isHotfix = workBranch?.kind === "hotfix";
  return isRelease || isHotfix
    ? null
    : `Production PRs for "${site}" must come from its develop or hotfix branch`;
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

  const siteWork = parseSiteEnvironmentWorkBranch(branch);
  if (siteWork) {
    if (siteWork.kind === "fix") {
      return `sites/${siteWork.site}/develop`;
    }

    return siteWork.kind === "hotfix" ? `sites/${siteWork.site}/main` : null;
  }

  if (branch.startsWith("sites/")) {
    return null;
  }

  return "develop";
}
