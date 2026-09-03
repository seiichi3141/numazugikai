import { getBranchPolicyError } from "./branch-policy-utils.mjs";

const error = getBranchPolicyError(process.env.PR_HEAD, process.env.PR_BASE);
if (error) {
  console.error(`Branch policy violation: ${error}`);
  process.exit(1);
}

console.log(
  `Branch policy passed: ${process.env.PR_HEAD} -> ${process.env.PR_BASE}`
);
