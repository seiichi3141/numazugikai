import { describe, expect, it } from "vitest";
import type { ProjectBudgetData } from "../types/project-budget";
import type { SpendingRecipient } from "../types/spending-flow";
import {
  ALL_PURPOSES,
  buildProjectRows,
  filterProjectRows,
  summarizeProjectCoverage,
} from "./build-project-rows";

const item = (id: number, purpose: string, name: string, amount: number) => ({
  id,
  purpose,
  moku: "目",
  name,
  amountThousandYen: amount,
  note: "",
});

const recipient = (no: number, amount: number): SpendingRecipient => ({
  kind: "subsidy",
  no,
  department: null,
  division: null,
  category: null,
  name: `補助${no}`,
  recipient: "沼津医師会",
  amountThousandYen: amount,
});

const contract = (
  name: string,
  amountYen: number | null,
  itemId: number | null
) => ({
  department: "総務部",
  name,
  party: "株式会社KK",
  contractedOn: "令和6年4月1日",
  amountYen,
  itemId,
});

const data: ProjectBudgetData = {
  fiscalYear: 2024,
  budgetTotalThousandYen: 1000,
  items: [
    item(1, "土木費", "道路維持事業費", 100),
    item(2, "衛生費", "健診", 300),
  ],
  constructions: [
    {
      name: "道路維持事業",
      itemId: 1,
      budgetThousandYen: 100,
      settledThousandYen: 90,
    },
    {
      name: "県営事業",
      itemId: null,
      budgetThousandYen: null,
      settledThousandYen: 5,
    },
  ],
  contracts: [
    contract("健診業務委託", 2000, 2),
    contract("未紐づけ", 3000, null),
  ],
  recipientLinks: [{ kind: "subsidy", no: 1, itemId: 2 }],
  sources: [],
};
const recipients = [recipient(1, 40), recipient(2, 60)];

describe("buildProjectRows", () => {
  it("決算・補助金・契約を事業へ集める", () => {
    const [road, health] = buildProjectRows(data, recipients);
    expect(road.settledThousandYen).toBe(90);
    expect(road.contracts).toEqual([]);
    expect(health.settledThousandYen).toBeNull();
    expect(health.recipients.map((row) => row.no)).toEqual([1]);
    expect(health.contracts.map((row) => row.name)).toEqual(["健診業務委託"]);
  });
});

describe("summarizeProjectCoverage", () => {
  it("資料全体に対して紐づいた割合の元になる値を返す", () => {
    expect(summarizeProjectCoverage(data, recipients)).toEqual({
      itemCount: 2,
      budgetThousandYen: 400,
      constructionCount: 2,
      settledThousandYen: 95,
      recipientCount: 2,
      linkedRecipientCount: 1,
      recipientThousandYen: 100,
      linkedRecipientThousandYen: 40,
      contractCount: 2,
      linkedContractCount: 1,
      contractYen: 5000,
      linkedContractYen: 2000,
    });
  });
});

describe("summarizeProjectCoverage の単価契約", () => {
  it("総額のない契約は金額0として数える", () => {
    const contracts = [contract("単価契約", null, 1)];
    const coverage = summarizeProjectCoverage({ ...data, contracts }, []);
    expect(coverage.linkedContractCount).toBe(1);
    expect(coverage.linkedContractYen).toBe(0);
  });
});

describe("filterProjectRows", () => {
  const rows = buildProjectRows(data, recipients);
  const base = { purpose: ALL_PURPOSES, query: "", linkedOnly: false };

  it("予算額の大きい順に並べる", () => {
    expect(filterProjectRows(rows, base).map((row) => row.id)).toEqual([2, 1]);
  });

  it("款で絞り込む", () => {
    const result = filterProjectRows(rows, { ...base, purpose: "土木費" });
    expect(result.map((row) => row.id)).toEqual([1]);
  });

  it("紐づいた相手先の名前でも探せる", () => {
    const result = filterProjectRows(rows, { ...base, query: "医師会" });
    expect(result.map((row) => row.id)).toEqual([2]);
  });

  it("実績のある事業だけに絞り込む", () => {
    const unlinked = { ...rows[0], id: 3, settledThousandYen: null };
    const result = filterProjectRows([...rows, unlinked], {
      ...base,
      linkedOnly: true,
    });
    expect(result.map((row) => row.id)).toEqual([2, 1]);
  });

  it("全角の検索語も契約の相手方に一致する", () => {
    const result = filterProjectRows(rows, { ...base, query: "ＫＫ" });
    expect(result.map((row) => row.id)).toEqual([2]);
  });
});
