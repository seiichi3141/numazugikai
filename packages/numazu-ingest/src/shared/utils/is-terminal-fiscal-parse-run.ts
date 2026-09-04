export function isTerminalFiscalParseRun(run: {
  status: string;
  parseStats: unknown;
}): boolean {
  if (run.status === "completed") return true;
  if (run.status === "rejected") return true;
  if (run.status !== "failed") return false;
  return !(
    run.parseStats &&
    typeof run.parseStats === "object" &&
    !Array.isArray(run.parseStats) &&
    Reflect.get(run.parseStats, "retryable") === true
  );
}
