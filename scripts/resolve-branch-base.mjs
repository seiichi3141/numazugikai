import { getExpectedBaseBranch } from "./branch-policy-utils.mjs";

const branch = process.argv[2];
const base = getExpectedBaseBranch(branch);

if (!base) {
  console.error(`Cannot infer a PR base from branch: "${branch ?? ""}"`);
  process.exit(1);
}

console.log(base);
