import { describe, expect, it } from "vitest";
import type { FetchedText } from "../fetchers/numazu-site-client";
import type { CurrentSessionBillUpsert } from "../repositories/ingest-repository";
import {
  type CurrentSessionBillsClient,
  type CurrentSessionBillsDependencies,
  ingestCurrentSessionBills,
} from "./ingest-current-session-bills";

const HTML = `
  <h2>第14回（令和8年9月）定例会</h2>
  <a name="teisyutu"></a>
  <ul class="list_disk">
    <li>報第22号　専決処分の報告について</li>
    <li><a href="gi-1.pdf">議第83号　一般会計補正予算について（PDF：20KB）</a></li>
  </ul>
`;

class FakeCurrentSessionBillsClient implements CurrentSessionBillsClient {
  constructor(private readonly html: string) {}

  async fetchHtml(url: string): Promise<FetchedText> {
    return {
      url,
      text: this.html,
      contentHash: "current-hash",
      etag: '"etag"',
      lastModified: "Fri, 04 Sep 2026 00:00:00 GMT",
    };
  }
}

function createDependencies(options?: {
  previousHash?: string | null;
  sessionExists?: boolean;
  failUpsertAt?: number;
}) {
  const upserts: CurrentSessionBillUpsert[] = [];
  const savedHashes: Parameters<
    CurrentSessionBillsDependencies["saveContentHash"]
  >[0][] = [];
  const ensuredSessions: Parameters<
    CurrentSessionBillsDependencies["ensureCouncilSession"]
  >[0][] = [];
  const dependencies: CurrentSessionBillsDependencies = {
    findContentHash: async () => options?.previousHash ?? null,
    findCouncilSessionBySlug: async () =>
      options?.sessionExists === false
        ? null
        : { id: "session-id", startDate: "2026-09-04" },
    ensureCouncilSession: async (session) => {
      ensuredSessions.push(session);
      return "created-session-id";
    },
    saveContentHash: async (record) => {
      savedHashes.push(record);
    },
    upsertCurrentSessionBill: async (bill) => {
      upserts.push(bill);
      if (options?.failUpsertAt === upserts.length) {
        throw new Error("保存失敗");
      }
      return { id: `bill-${upserts.length}`, created: upserts.length === 1 };
    },
  };
  return { dependencies, ensuredSessions, savedHashes, upserts };
}

describe("ingestCurrentSessionBills", () => {
  it("開会中の提出議案を保存して成功後にだけハッシュを記録する", async () => {
    const fake = createDependencies();
    const result = await ingestCurrentSessionBills({
      client: new FakeCurrentSessionBillsClient(HTML),
      dependencies: fake.dependencies,
    });

    expect(result).toEqual({
      skipped: false,
      sessionSlug: "2026-14",
      billCount: 2,
      createdCount: 1,
      updatedCount: 1,
    });
    expect(fake.upserts).toHaveLength(2);
    expect(fake.upserts[0]).toMatchObject({
      councilSessionId: "session-id",
      billNumber: "報第22号",
      submittedOn: "2026-09-04",
      sourceRecordKey: null,
      submitter: null,
    });
    expect(fake.savedHashes).toHaveLength(1);
  });

  it("取得内容が前回と同じならDB更新を省略する", async () => {
    const fake = createDependencies({ previousHash: "current-hash" });
    const result = await ingestCurrentSessionBills({
      client: new FakeCurrentSessionBillsClient(HTML),
      dependencies: fake.dependencies,
    });

    expect(result.skipped).toBe(true);
    expect(result.sessionSlug).toBe("2026-14");
    expect(result.billCount).toBe(2);
    expect(fake.upserts).toEqual([]);
    expect(fake.savedHashes).toEqual([]);
  });

  it("会期が未登録なら開会中ページを根拠に暫定会期を作る", async () => {
    const fake = createDependencies({ sessionExists: false });

    await ingestCurrentSessionBills({
      client: new FakeCurrentSessionBillsClient(HTML),
      dependencies: fake.dependencies,
      today: "2026-09-04",
    });

    expect(fake.ensuredSessions).toEqual([
      expect.objectContaining({
        slug: "2026-14",
        kind: "regular",
        startDate: "2026-09-04",
        endDate: "2026-09-04",
      }),
    ]);
    expect(fake.upserts[0]?.councilSessionId).toBe("created-session-id");
  });

  it("提出者を確定できない発議は永続identityを付けずに保存する", async () => {
    const fake = createDependencies();
    const html = HTML.replace(
      "</ul>",
      "<li>発議第1号　市政に関する意見書について</li></ul>"
    );

    await ingestCurrentSessionBills({
      client: new FakeCurrentSessionBillsClient(html),
      dependencies: fake.dependencies,
    });

    expect(fake.upserts.at(-1)).toMatchObject({
      billNumber: "発議第1号",
      submitter: null,
      sourceRecordKey: null,
    });
  });

  it("議案保存が途中で失敗した場合はハッシュを記録しない", async () => {
    const fake = createDependencies({ failUpsertAt: 2 });

    await expect(
      ingestCurrentSessionBills({
        client: new FakeCurrentSessionBillsClient(HTML),
        dependencies: fake.dependencies,
      })
    ).rejects.toThrow("保存失敗");
    expect(fake.savedHashes).toEqual([]);
  });

  it("提出議案を読み取れない場合は失敗する", async () => {
    const fake = createDependencies();

    await expect(
      ingestCurrentSessionBills({
        client: new FakeCurrentSessionBillsClient("<h1>お知らせ</h1>"),
        dependencies: fake.dependencies,
      })
    ).rejects.toThrow("開会中の会期または提出議案を読み取れなかった");
    expect(fake.savedHashes).toEqual([]);
  });
});
