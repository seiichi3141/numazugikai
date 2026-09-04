import { describe, expect, it } from "vitest";
import { fiscalSourceProfiles } from "../shared/fiscal-source-profiles";
import { ingestFiscalSources } from "./ingest-fiscal-sources";

describe("ingestFiscalSources", () => {
  it("staging保存失敗時にparse runを再試行可能な失敗として確定する", async () => {
    const failedRuns: { parseRunId: string; errorMessage: string }[] = [];
    const profile = fiscalSourceProfiles[0];

    await expect(
      ingestFiscalSources({
        ingestionRunId: "ingestion-run",
        profiles: [profile],
        client: {
          fetchPdfDocument: async () => ({
            url: profile.url,
            contentHash: "content-hash",
            etag: null,
            lastModified: null,
            text: "令和8年度一般会計",
            bytes: new Uint8Array([1]),
          }),
        },
        repository: {
          prepareSource: async () => ({
            sourceId: "source",
            sourceVersionId: "source-version",
            parseRunId: "parse-run",
            alreadyParsed: false,
          }),
          saveStaging: async () => {
            throw new Error("staging unavailable");
          },
          failParseRun: async (failedRun) => {
            failedRuns.push(failedRun);
          },
          findPreviousRecords: async () => [],
        },
      })
    ).rejects.toThrow("staging unavailable");

    expect(failedRuns).toEqual([
      {
        parseRunId: "parse-run",
        errorMessage: "staging unavailable",
      },
    ]);
  });

  it("前回適用済み候補と比較して変更候補を保存する", async () => {
    const profile = fiscalSourceProfiles[0];
    let savedChangeKind: string | null = null;

    await ingestFiscalSources({
      ingestionRunId: "ingestion-run",
      profiles: [profile],
      client: {
        fetchPdfDocument: async () => ({
          url: profile.url,
          contentHash: "new-content-hash",
          etag: null,
          lastModified: null,
          text: "改訂版",
          bytes: new Uint8Array([2]),
        }),
      },
      repository: {
        prepareSource: async () => ({
          sourceId: "source",
          sourceVersionId: "source-version",
          parseRunId: "parse-run",
          alreadyParsed: false,
        }),
        findPreviousRecords: async () => [
          {
            targetId: "previous-record",
            recordKind: "document_metadata",
            sourceRecordKey: profile.profileKey,
            contentFingerprint: "previous-fingerprint",
            parsedPayload: { contentHash: "old-content-hash" },
          },
        ],
        saveStaging: async ({ rows }) => {
          savedChangeKind = rows[0]?.changeKind ?? null;
          return "batch";
        },
        failParseRun: async () => {},
      },
    });

    expect(savedChangeKind).toBe("changed");
  });
});
