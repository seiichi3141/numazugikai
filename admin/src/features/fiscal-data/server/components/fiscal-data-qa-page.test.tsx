// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { FiscalImportBatchList } from "./fiscal-data-qa-page";

Object.assign(globalThis, {
  React,
  IS_REACT_ACT_ENVIRONMENT: true,
});

describe("FiscalImportBatchList", () => {
  it("取得版・原本保持・検算件数を確認できる", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <FiscalImportBatchList
          result={{
            page: 1,
            totalCount: 1,
            items: [
              {
                id: "batch-1",
                sourceTitle: "令和8年度 一般会計",
                sourceUrl: "https://www.city.numazu.shizuoka.jp/example.pdf",
                sourceKind: "budget_overview",
                fiscalYear: 2026,
                profileKey: "budget-overview-2026-general-account",
                profileVersion: "1.0.0",
                parserName: "numazu-fiscal-document-metadata",
                parserVersion: "1.0.0",
                status: "awaiting_review",
                retentionState: "retained",
                fetchedAt: "2026-09-04T15:00:00.000Z",
                finishedAt: "2026-09-04T15:01:00.000Z",
                discoveredCount: 1,
                stagedCount: 1,
                hardErrorCount: 0,
                warningCount: 2,
                pendingCount: 1,
                validationMessages: ["warning: 表題を確認"],
              },
            ],
          }}
        />
      );
    });

    expect(container.textContent).toContain("令和8年度 一般会計");
    expect(container.textContent).toContain("原本保持");
    expect(container.textContent).toContain("保持中");
    expect(container.textContent).toContain("解析完了日時");
    expect(container.textContent).toContain("発見 1件");
    expect(container.textContent).toContain("warning 2件");
    expect(container.textContent).toContain("warning: 表題を確認");
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      "https://www.city.numazu.shizuoka.jp/example.pdf"
    );

    await act(async () => root.unmount());
    container.remove();
  });
});
