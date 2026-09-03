import { isLifecycleBranch } from "./branch-policy-utils.mjs";

process.exit(isLifecycleBranch(process.argv[2]) ? 0 : 1);
