import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { findAllCouncilSessions } from "@/features/council-sessions/server/repositories/council-session-repository";
import { jsonResult } from "../utils/json-result";

export function registerCouncilSessionsTools(server: McpServer): void {
  server.registerTool(
    "list_council_sessions",
    {
      title: "会期一覧を取得",
      description:
        "登録されているすべての会期を返す。議案作成時のcouncil_session_id指定に利用できる。",
      inputSchema: {},
    },
    async () => {
      const sessions = await findAllCouncilSessions();
      return jsonResult(sessions);
    }
  );
}
