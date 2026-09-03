import {
  ensureCouncilSession,
  upsertCouncilSession,
} from "../../packages/numazu-ingest/src/repositories/ingest-repository";
import { NUMAZU_SITE_URLS } from "../../packages/numazu-ingest/src/shared/constants-site";
import { adminClient, cleanupTestCouncilSession } from "./utils";

describe("ingest council session repository", () => {
  const sessionIds: string[] = [];

  afterEach(async () => {
    for (const sessionId of sessionIds.splice(0)) {
      await cleanupTestCouncilSession(sessionId);
    }
  });

  it("開会中ページの暫定会期を結果PDFの会期情報へ更新する", async () => {
    const slug = `provisional-session-${Date.now()}`;
    const externalCouncilId = `provisional-external-${Date.now()}`;
    const provisionalId = await ensureCouncilSession({
      name: "暫定会期",
      slug,
      sessionNumber: 0,
      kind: "regular",
      startDate: "2026-09-04",
      endDate: "2026-09-04",
      sourceUrl: NUMAZU_SITE_URLS.billDocuments,
      externalCouncilId,
    });
    sessionIds.push(provisionalId);

    const resultSourceUrl =
      "https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/result.pdf";
    const authoritativeId = await ensureCouncilSession(
      {
        name: "令和8年第14回臨時会",
        slug,
        sessionNumber: 14,
        kind: "extraordinary",
        startDate: "2026-09-10",
        endDate: "2026-09-12",
        sourceUrl: resultSourceUrl,
      },
      { replaceExistingSourceUrl: NUMAZU_SITE_URLS.billDocuments }
    );

    expect(authoritativeId).toBe(provisionalId);
    const { data, error } = await adminClient
      .from("council_sessions")
      .select(
        "name, session_number, kind, start_date, end_date, source_url, external_council_id"
      )
      .eq("id", provisionalId)
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({
      name: "令和8年第14回臨時会",
      session_number: 14,
      kind: "extraordinary",
      start_date: "2026-09-10",
      end_date: "2026-09-12",
      source_url: resultSourceUrl,
      external_council_id: externalCouncilId,
    });
  });

  it("会期予定ページ由来の確定済み会期は結果PDFの推定値で上書きしない", async () => {
    const slug = `authoritative-session-${Date.now()}`;
    const scheduleSourceUrl = NUMAZU_SITE_URLS.sessionSchedule;
    const sessionId = await ensureCouncilSession({
      name: "令和8年第15回定例会",
      slug,
      sessionNumber: 15,
      kind: "regular",
      startDate: "2026-11-20",
      endDate: "2026-12-15",
      sourceUrl: scheduleSourceUrl,
    });
    sessionIds.push(sessionId);

    await ensureCouncilSession(
      {
        name: "令和8年第15回定例会",
        slug,
        sessionNumber: 15,
        kind: "regular",
        startDate: "2026-11-25",
        endDate: "2026-12-12",
        sourceUrl:
          "https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/result.pdf",
      },
      { replaceExistingSourceUrl: NUMAZU_SITE_URLS.billDocuments }
    );

    const { data, error } = await adminClient
      .from("council_sessions")
      .select("start_date, end_date, source_url")
      .eq("id", sessionId)
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({
      start_date: "2026-11-20",
      end_date: "2026-12-15",
      source_url: scheduleSourceUrl,
    });
  });

  it("会期予定ページの再取り込みで既存の外部会議IDを消さない", async () => {
    const slug = `schedule-session-${Date.now()}`;
    const externalCouncilId = `schedule-external-${Date.now()}`;
    const sessionId = await upsertCouncilSession({
      name: "令和8年第16回定例会",
      slug,
      sessionNumber: 16,
      kind: "regular",
      startDate: "2026-12-01",
      endDate: "2026-12-20",
      sourceUrl: NUMAZU_SITE_URLS.sessionSchedule,
      externalCouncilId,
    });
    sessionIds.push(sessionId);

    await upsertCouncilSession({
      name: "令和8年第16回定例会",
      slug,
      sessionNumber: 16,
      kind: "regular",
      startDate: "2026-12-02",
      endDate: "2026-12-21",
      sourceUrl: NUMAZU_SITE_URLS.sessionSchedule,
    });

    const { data, error } = await adminClient
      .from("council_sessions")
      .select("start_date, end_date, external_council_id")
      .eq("id", sessionId)
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({
      start_date: "2026-12-02",
      end_date: "2026-12-21",
      external_council_id: externalCouncilId,
    });
  });
});
