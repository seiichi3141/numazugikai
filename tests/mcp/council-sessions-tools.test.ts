import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { registerCouncilSessionsTools } from "../../admin/src/features/mcp/server/tools/register-council-sessions-tools";
import {
  cleanupTestCouncilSession,
  createTestCouncilSession,
} from "../supabase/utils";
import { createTestRegistry, type TestMcpRegistry } from "./utils";

describe("MCP council_sessions tools", () => {
  let registry: TestMcpRegistry;
  const councilSessionIds: string[] = [];

  beforeEach(() => {
    registry = createTestRegistry();
    registerCouncilSessionsTools(registry.asMcpServer());
  });

  afterEach(async () => {
    for (const id of councilSessionIds.splice(0))
      await cleanupTestCouncilSession(id);
  });

  describe("list_council_sessions", () => {
    it("登録済みの会期を start_date 降順で返す", async () => {
      const older = await createTestCouncilSession({
        name: `古い会期-${Date.now()}`,
        start_date: "2020-01-01",
        end_date: "2020-06-30",
      });
      const newer = await createTestCouncilSession({
        name: `新しい会期-${Date.now()}`,
        start_date: "2030-01-01",
        end_date: "2030-06-30",
      });
      councilSessionIds.push(older.id, newer.id);

      const result = await registry.callTool<
        Array<{ id: string; name: string; start_date: string }>
      >("list_council_sessions");

      const ids = result.map((s) => s.id);
      const newerIdx = ids.indexOf(newer.id);
      const olderIdx = ids.indexOf(older.id);
      expect(newerIdx).toBeGreaterThanOrEqual(0);
      expect(olderIdx).toBeGreaterThanOrEqual(0);
      // start_date 降順なので newer の方が前に来る
      expect(newerIdx).toBeLessThan(olderIdx);
    });
  });

  it("登録されているツール名が想定通り", () => {
    expect(registry.toolNames()).toEqual(["list_council_sessions"]);
  });
});
