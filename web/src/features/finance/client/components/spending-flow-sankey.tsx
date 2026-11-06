"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { SankeyColumn } from "../../shared/types/spending-flow";
import {
  formatOkuYen,
  isLinkConnected,
  SANKEY_COLUMNS,
  type SankeyLayoutLink,
  type SankeyLayoutNode,
  type SankeyLayoutOptions,
  sankeyColumnGap,
} from "../../shared/utils/build-spending-flow";

const COLUMN_DISPLAY: Record<
  SankeyColumn,
  { heading: string; node: string; link: string }
> = {
  revenue: {
    heading: "入ってきたお金",
    node: "fill-chart-2",
    link: "stroke-chart-2",
  },
  account: { heading: "", node: "fill-mirai-text", link: "stroke-chart-1" },
  purpose: {
    heading: "分野別",
    node: "fill-chart-1",
    link: "stroke-chart-4",
  },
  expense: {
    heading: "使い方別",
    node: "fill-chart-4",
    link: "stroke-chart-4",
  },
};

type Props = {
  nodes: SankeyLayoutNode[];
  links: SankeyLayoutLink[];
  size: SankeyLayoutOptions;
};

export function SpendingFlowSankey({ nodes, links, size }: Props) {
  const { width, height, nodeWidth } = size;
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeId = hoveredId ?? selectedId;
  const toggle = (id: string) =>
    setSelectedId((current) => (current === id ? null : id));
  const labelMargin = 16;
  const topMargin = 28;
  const rightMargin = 240;

  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: 横スクロール領域をキーボードで動かせるようにする
    <div className="overflow-x-auto" tabIndex={0}>
      <svg
        viewBox={`0 ${-topMargin} ${width + rightMargin} ${height + topMargin + labelMargin}`}
        className="min-w-[860px]"
        role="img"
        aria-label="歳入から一般会計を経て、分野別、使い方別へ分かれるお金の流れの図。同じ内容を図の下の表でも確認できます。"
      >
        {SANKEY_COLUMNS.map((column, index) => (
          <text
            key={column}
            x={sankeyColumnGap(size) * index}
            y={-12}
            className="fill-mirai-text-secondary text-[13px] font-bold"
          >
            {COLUMN_DISPLAY[column].heading}
          </text>
        ))}
        <g fill="none">
          {links.map((link) => {
            const isDimmed =
              activeId !== null && !isLinkConnected(link, activeId);
            return (
              <path
                key={`${link.source}-${link.target}`}
                d={link.path}
                strokeWidth={link.thickness}
                className={cn(
                  COLUMN_DISPLAY[link.sourceColumn].link,
                  "transition-opacity",
                  isDimmed ? "opacity-5" : "opacity-40"
                )}
              >
                <title>{formatOkuYen(link.valueThousandYen)}</title>
              </path>
            );
          })}
        </g>
        {nodes.map((node) => (
          <g
            key={node.id}
            role="button"
            tabIndex={0}
            aria-pressed={selectedId === node.id}
            aria-label={`${node.label} ${formatOkuYen(node.valueThousandYen)}`}
            className="cursor-pointer outline-none focus-visible:opacity-70"
            onClick={() => toggle(node.id)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              toggle(node.id);
            }}
            onMouseEnter={() => setHoveredId(node.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <rect
              x={node.x}
              y={node.y}
              width={nodeWidth}
              height={node.height}
              className={COLUMN_DISPLAY[node.column].node}
            />
            <text
              x={node.x + nodeWidth + 6}
              y={node.y + node.height / 2}
              dominantBaseline="middle"
              className="fill-mirai-text text-[12px]"
            >
              {node.label}{" "}
              <tspan className="fill-mirai-text-muted tabular-nums">
                {formatOkuYen(node.valueThousandYen)}
              </tspan>
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
