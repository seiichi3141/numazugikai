import { execFileSync } from "node:child_process";

const databaseUrl =
  process.env.SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54432/postgres";

export function executeInTestDatabase(sql: string): string {
  return execFileSync(
    "psql",
    [
      databaseUrl,
      "--no-psqlrc",
      "--set",
      "ON_ERROR_STOP=1",
      "--tuples-only",
      "--command",
      sql,
    ],
    { encoding: "utf8" }
  ).trim();
}
