import type {
  SankeyColumn,
  SankeyLink,
  SankeyNode,
  SpendingFlowData,
} from "../types/spending-flow";

/** 歳入のうち個別に見せる区分。残りは「その他」にまとめる。 */
const NAMED_REVENUES = new Set([
  "市税",
  "国庫支出金",
  "地方交付税",
  "県支出金",
  "市債",
  "地方消費税交付金",
  "繰入金",
  "寄附金",
  "繰越金",
]);

/** 節を、使い道が伝わる単位に束ねる。 */
const EXPENSE_GROUPS: Record<string, string> = {
  報酬: "報酬・給料など",
  給料: "報酬・給料など",
  職員手当等: "報酬・給料など",
  共済費: "報酬・給料など",
  扶助費: "扶助費",
  負担金補助及び交付金: "負担金補助及び交付金",
  委託料: "委託料",
  工事請負費: "工事請負費",
  繰出金: "繰出金",
  償還金利子及び割引料: "償還金利子及び割引料",
  積立金: "積立金",
};

const OTHER_LABEL = "その他";
const ACCOUNT_ID = "account:general";
const CARRY_OVER_ID = "purpose:carry-over";

function sortByValueWithOtherLast(
  entries: [string, number][]
): [string, number][] {
  return [...entries].sort(([aName, aValue], [bName, bValue]) => {
    if (aName === OTHER_LABEL) return 1;
    if (bName === OTHER_LABEL) return -1;
    return bValue - aValue;
  });
}

function sumBy<T>(items: readonly T[], read: (item: T) => number): number {
  return items.reduce((total, item) => total + read(item), 0);
}

function addTo<K>(totals: Map<K, number>, key: K, value: number): void {
  totals.set(key, (totals.get(key) ?? 0) + value);
}

/**
 * 歳入 → 一般会計 → 款 → 節の4列に組み立てる。
 *
 * 歳入と歳出の差額は翌年度へ持ち越されるため、款の列に別の行として置き、
 * 一般会計に入った額と出た額が必ず一致するようにする。
 */
export function buildSpendingFlow(data: SpendingFlowData): {
  nodes: SankeyNode[];
  links: SankeyLink[];
} {
  const nodes: SankeyNode[] = [];
  const links: SankeyLink[] = [];

  const revenueTotals = new Map<string, number>();
  for (const item of data.revenue) {
    const name = NAMED_REVENUES.has(item.name) ? item.name : OTHER_LABEL;
    addTo(revenueTotals, name, item.amountThousandYen);
  }
  for (const [name, value] of sortByValueWithOtherLast([...revenueTotals])) {
    const id = `revenue:${name}`;
    nodes.push({
      id,
      label: name,
      column: "revenue",
      valueThousandYen: value,
    });
    links.push({ source: id, target: ACCOUNT_ID, valueThousandYen: value });
  }

  const revenueTotal = sumBy(data.revenue, (item) => item.amountThousandYen);
  nodes.push({
    id: ACCOUNT_ID,
    label: "一般会計",
    column: "account",
    valueThousandYen: revenueTotal,
  });

  data.purposeNames.forEach((name, column) => {
    const id = `purpose:${name}`;
    const value = sumBy(
      data.expenditureRows,
      (row) => row.amounts[column] ?? 0
    );
    nodes.push({
      id,
      label: name,
      column: "purpose",
      valueThousandYen: value,
    });
    links.push({ source: ACCOUNT_ID, target: id, valueThousandYen: value });
  });

  const expenditureTotal = sumBy(data.expenditureRows, (row) =>
    sumBy(row.amounts, (amount) => amount)
  );
  const carryOver = revenueTotal - expenditureTotal;
  if (carryOver > 0) {
    nodes.push({
      id: CARRY_OVER_ID,
      label: "翌年度へ",
      column: "purpose",
      valueThousandYen: carryOver,
    });
    links.push({
      source: ACCOUNT_ID,
      target: CARRY_OVER_ID,
      valueThousandYen: carryOver,
    });
  }

  const expenseTotals = new Map<string, number>();
  const expenseLinks = new Map<string, Map<string, number>>();
  for (const row of data.expenditureRows) {
    const group = EXPENSE_GROUPS[row.name] ?? OTHER_LABEL;
    data.purposeNames.forEach((purpose, column) => {
      const value = row.amounts[column] ?? 0;
      if (value === 0) return;
      addTo(expenseTotals, group, value);
      const byPurpose = expenseLinks.get(group) ?? new Map<string, number>();
      addTo(byPurpose, purpose, value);
      expenseLinks.set(group, byPurpose);
    });
  }
  for (const [name, value] of sortByValueWithOtherLast([...expenseTotals])) {
    nodes.push({
      id: `expense:${name}`,
      label: name,
      column: "expense",
      valueThousandYen: value,
    });
  }
  for (const [group, byPurpose] of expenseLinks) {
    for (const [purpose, value] of byPurpose) {
      links.push({
        source: `purpose:${purpose}`,
        target: `expense:${group}`,
        valueThousandYen: value,
      });
    }
  }

  return { nodes, links };
}

export type SankeyLayoutNode = SankeyNode & {
  x: number;
  y: number;
  height: number;
};

export type SankeyLayoutLink = SankeyLink & {
  sourceColumn: SankeyColumn;
  path: string;
  thickness: number;
};

export type SankeyLayoutOptions = {
  width: number;
  height: number;
  nodeWidth: number;
  nodePadding: number;
};

const MIN_LINK_THICKNESS = 0.5;

export const SANKEY_COLUMNS: readonly SankeyColumn[] = [
  "revenue",
  "account",
  "purpose",
  "expense",
];

/** 列の間隔。見出しの位置もこの値から決める。 */
export function sankeyColumnGap(options: SankeyLayoutOptions): number {
  return (options.width - options.nodeWidth) / (SANKEY_COLUMNS.length - 1);
}

/**
 * ノードを列ごとに積み、リンクの帯の座標を計算する。
 *
 * 金額と高さの比率は全列で共通にする。列によって比率を変えると、同じ金額の
 * 帯の太さが変わって見え、流れの大小を読み違えるため。
 */
export function layoutSankey(
  nodes: readonly SankeyNode[],
  links: readonly SankeyLink[],
  options: SankeyLayoutOptions
): { nodes: SankeyLayoutNode[]; links: SankeyLayoutLink[] } {
  const { height, nodeWidth, nodePadding } = options;
  const columns = SANKEY_COLUMNS.map((column) =>
    nodes.filter((node) => node.column === column)
  );
  const scale = Math.min(
    ...columns
      .filter((column) => column.length > 0)
      .map(
        (column) =>
          (height - nodePadding * (column.length - 1)) /
          sumBy(column, (node) => node.valueThousandYen)
      )
  );
  const columnGap = sankeyColumnGap(options);

  const laidOut = new Map<string, SankeyLayoutNode>();
  columns.forEach((column, columnIndex) => {
    let y = 0;
    for (const node of column) {
      const nodeHeight = Math.max(node.valueThousandYen * scale, 1);
      laidOut.set(node.id, {
        ...node,
        x: columnGap * columnIndex,
        y,
        height: nodeHeight,
      });
      y += nodeHeight + nodePadding;
    }
  });

  const sourceOffsets = new Map<string, number>();
  const targetOffsets = new Map<string, number>();
  const layoutLinks = links.map((link) => {
    const source = laidOut.get(link.source);
    const target = laidOut.get(link.target);
    if (!source || !target) {
      throw new Error(`リンクの端点がない: ${link.source} -> ${link.target}`);
    }
    // 座標は金額に比例させ、最小の太さは描画だけに使う。少額の帯が積み重なって
    // ノードからはみ出すのを防ぐ
    const scaledThickness = link.valueThousandYen * scale;
    const thickness = Math.max(scaledThickness, MIN_LINK_THICKNESS);
    const sourceOffset = sourceOffsets.get(link.source) ?? 0;
    const targetOffset = targetOffsets.get(link.target) ?? 0;
    sourceOffsets.set(link.source, sourceOffset + scaledThickness);
    targetOffsets.set(link.target, targetOffset + scaledThickness);

    const startX = source.x + nodeWidth;
    const endX = target.x;
    const startY = source.y + sourceOffset + scaledThickness / 2;
    const endY = target.y + targetOffset + scaledThickness / 2;
    const middleX = (startX + endX) / 2;
    return {
      ...link,
      sourceColumn: source.column,
      thickness,
      path: `M ${startX} ${startY} C ${middleX} ${startY}, ${middleX} ${endY}, ${endX} ${endY}`,
    };
  });

  return { nodes: [...laidOut.values()], links: layoutLinks };
}

/** ノードの選択時に残す、そのノードに直接つながるリンクかどうか。 */
export function isLinkConnected(link: SankeyLink, nodeId: string): boolean {
  return link.source === nodeId || link.target === nodeId;
}

/** 図の見出しに使う億円表記。小数第1位まで四捨五入する。 */
export function formatOkuYen(thousandYen: number): string {
  return `${(thousandYen / 100000).toFixed(1)}億円`;
}
