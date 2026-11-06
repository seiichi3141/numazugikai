import { describe, expect, it } from "vitest";
import spendingFlow2024 from "../data/spending-flow-2024.json";
import type { SpendingFlowData } from "../types/spending-flow";
import {
  buildSpendingFlow,
  formatOkuYen,
  isLinkConnected,
  layoutSankey,
} from "./build-spending-flow";

const data = spendingFlow2024 as SpendingFlowData;

const fixture: SpendingFlowData = {
  fiscalYear: 2024,
  purposeNames: ["議会費", "民生費"],
  revenue: [
    { code: 1, name: "市税", amountThousandYen: 60 },
    { code: 2, name: "地方譲与税", amountThousandYen: 10 },
    { code: 3, name: "利子割交付金", amountThousandYen: 30 },
  ],
  expenditureRows: [
    { name: "報酬", amounts: [10, 0] },
    { name: "給料", amounts: [5, 15] },
    { name: "旅費", amounts: [0, 60] },
  ],
  kindTotals: {
    subsidy: { amountThousandYen: 0, count: 0 },
    burden: { amountThousandYen: 0, count: 0 },
    grant: { amountThousandYen: 0, count: 0 },
  },
  recipients: [],
  sources: [],
};

describe("buildSpendingFlow", () => {
  it("少額の歳入と未分類の節を「その他」にまとめる", () => {
    const { nodes } = buildSpendingFlow(fixture);
    expect(nodes.find((node) => node.id === "revenue:その他")).toMatchObject({
      valueThousandYen: 40,
    });
    expect(nodes.find((node) => node.id === "expense:その他")).toMatchObject({
      valueThousandYen: 60,
    });
    expect(
      nodes.find((node) => node.id === "expense:報酬・給料など")
    ).toMatchObject({ valueThousandYen: 30 });
  });

  it("歳入と歳出の差額を翌年度へ回し、一般会計の入出金を一致させる", () => {
    const { nodes, links } = buildSpendingFlow(fixture);
    expect(nodes.find((node) => node.label === "翌年度へ")).toMatchObject({
      valueThousandYen: 10,
    });
    const sum = (key: "source" | "target") =>
      links
        .filter((link) => link[key] === "account:general")
        .reduce((total, link) => total + link.valueThousandYen, 0);
    expect(sum("source")).toBe(sum("target"));
  });

  it("金額0の款と節の組み合わせにはリンクを作らない", () => {
    const { links } = buildSpendingFlow(fixture);
    expect(
      links.filter(
        (link) =>
          link.source === "purpose:議会費" && link.target === "expense:その他"
      )
    ).toEqual([]);
  });
});

describe("layoutSankey", () => {
  const options = {
    width: 800,
    height: 400,
    nodeWidth: 10,
    nodePadding: 10,
  };

  it("全列の高さが図に収まる", () => {
    const { nodes, links } = buildSpendingFlow(fixture);
    const layout = layoutSankey(nodes, links, options);
    for (const node of layout.nodes) {
      expect(node.y + node.height).toBeLessThanOrEqual(options.height + 2);
    }
  });

  it("同じ金額は列が違っても同じ太さになる", () => {
    const layout = layoutSankey(
      [
        { id: "a", label: "a", column: "revenue", valueThousandYen: 10 },
        { id: "b", label: "b", column: "revenue", valueThousandYen: 10 },
        { id: "c", label: "c", column: "account", valueThousandYen: 20 },
      ],
      [
        { source: "a", target: "c", valueThousandYen: 10 },
        { source: "b", target: "c", valueThousandYen: 10 },
      ],
      options
    );
    expect(layout.links[0]?.thickness).toBe(layout.links[1]?.thickness);
  });

  it("少額のリンクが重なってもノードの高さからはみ出さない", () => {
    const { nodes, links } = layoutSankey(
      [
        { id: "a", label: "a", column: "revenue", valueThousandYen: 1000000 },
        { id: "b", label: "b", column: "account", valueThousandYen: 10 },
        { id: "c", label: "c", column: "account", valueThousandYen: 999990 },
        { id: "d", label: "d", column: "purpose", valueThousandYen: 5 },
        { id: "e", label: "e", column: "purpose", valueThousandYen: 5 },
      ],
      [
        { source: "b", target: "d", valueThousandYen: 5 },
        { source: "b", target: "e", valueThousandYen: 5 },
      ],
      options
    );
    const node = nodes.find((item) => item.id === "b");
    const startYs = links.map((link) => Number(link.path.split(" ")[2]));
    for (const startY of startYs) {
      expect(startY).toBeGreaterThanOrEqual(node?.y ?? 0);
      expect(startY).toBeLessThanOrEqual((node?.y ?? 0) + (node?.height ?? 0));
    }
  });

  it("端点のないリンクは例外にする", () => {
    expect(() =>
      layoutSankey([], [{ source: "x", target: "y", valueThousandYen: 1 }], {
        ...options,
      })
    ).toThrow("リンクの端点がない");
  });
});

describe("isLinkConnected", () => {
  it("どちらかの端点が一致すれば接続とみなす", () => {
    const link = { source: "a", target: "b", valueThousandYen: 1 };
    expect(isLinkConnected(link, "a")).toBe(true);
    expect(isLinkConnected(link, "b")).toBe(true);
    expect(isLinkConnected(link, "c")).toBe(false);
  });
});

describe("formatOkuYen", () => {
  it("千円単位の金額を億円にする", () => {
    expect(formatOkuYen(92736569)).toBe("927.4億円");
  });
});

describe("令和6年度の生成データ", () => {
  it("公式の歳入総額・歳出総額と一致する", () => {
    const { nodes } = buildSpendingFlow(data);
    expect(nodes.find((node) => node.id === "account:general")).toMatchObject({
      valueThousandYen: 96520466,
    });
    const expenditure = nodes
      .filter((node) => node.column === "expense")
      .reduce((total, node) => total + node.valueThousandYen, 0);
    expect(expenditure).toBe(92736569);
  });

  it("3種類の一覧の件数が公式の件数と一致する", () => {
    for (const kind of ["subsidy", "burden", "grant"] as const) {
      expect(data.recipients.filter((row) => row.kind === kind)).toHaveLength(
        data.kindTotals[kind].count
      );
    }
  });
});
