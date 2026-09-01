import { createClient } from "@supabase/supabase-js";
import type { Database } from "@mirai-gikai/supabase";

export type AdminClient = ReturnType<typeof createAdminClient>;

export function createAdminClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );
}

// シードが作るデータだけを消す。
// 議案（bills）・会期（council_sessions）とその付随データは
// 取り込み（@mirai-gikai/numazu-ingest）が入れるため、シードでは触らない。
// ここに bills を含めると、取り込み済みの実データが `pnpm seed` で消える。
const TABLES_TO_CLEAR = [
  "interview_report",
  "interview_messages",
  "interview_sessions",
  "interview_questions",
  "interview_configs",
  "chats",
  "bills_tags",
  "tags",
] as const;

export async function clearAllData(supabase: AdminClient) {
  console.log("🧹 Clearing existing data...");

  for (const table of TABLES_TO_CLEAR) {
    await supabase
      .from(table)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
  }

  console.log("✅ Cleared existing data");
}
