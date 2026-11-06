import "server-only";
import { notFound } from "next/navigation";
import { Container } from "@/components/layouts/container";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { routes } from "@/lib/routes";
import { SpendingFlowSankey } from "../../client/components/spending-flow-sankey";
import { SpendingRecipientExplorer } from "../../client/components/spending-recipient-explorer";
import {
  buildSpendingFlow,
  formatOkuYen,
  layoutSankey,
} from "../../shared/utils/build-spending-flow";
import { formatFiscalYear } from "../../shared/utils/format-fiscal-year";
import { getSpendingFlow } from "../loaders/get-spending-flow";

const SANKEY_SIZE = {
  width: 900,
  height: 640,
  nodeWidth: 12,
  nodePadding: 14,
};

export function SpendingFlowPage({ fiscalYear }: { fiscalYear: number }) {
  const data = getSpendingFlow(fiscalYear);
  if (!data) notFound();

  const { nodes, links } = buildSpendingFlow(data);
  const layout = layoutSankey(nodes, links, SANKEY_SIZE);
  const yearLabel = formatFiscalYear(fiscalYear);
  const totals = Object.values(data.kindTotals);
  const recipientCount = totals.reduce((sum, item) => sum + item.count, 0);
  const recipientAmount = totals.reduce(
    (sum, item) => sum + item.amountThousandYen,
    0
  );

  return (
    <div className="min-h-dvh bg-mirai-surface-muted">
      <Container
        size="wide"
        className="flex flex-col gap-8 pb-10 pt-24 md:pt-8"
      >
        <Breadcrumb
          items={[
            { label: "トップ", href: routes.home() },
            { label: "財政", href: routes.finance() },
            { label: yearLabel, href: routes.financeYear(fiscalYear) },
            { label: "お金の流れ" },
          ]}
        />
        <header className="space-y-2">
          <p className="text-sm font-bold text-mirai-text-secondary">試作</p>
          <h1 className="text-3xl font-bold text-mirai-text">
            {yearLabel}のお金の流れ
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            沼津市の一般会計の決算を、公式資料から図にしています。項目の上に指を置くか選ぶと、つながる流れだけを強調します。本サービスは非公式であり、正式な内容は各公式資料をご確認ください。
          </p>
        </header>

        <section className="space-y-4" aria-labelledby="flow-heading">
          <h2
            id="flow-heading"
            className="text-[22px] font-bold leading-[1.48] text-mirai-text"
          >
            入ってきたお金が、何に使われたか
          </h2>
          <div className="rounded-xl border bg-card p-4">
            <SpendingFlowSankey
              nodes={layout.nodes}
              links={layout.links}
              size={SANKEY_SIZE}
            />
          </div>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            特別会計や企業会計は含みません。繰出金は、一般会計からそれらの会計へ移すお金です。歳入のどの財源がどの分野に充てられたかを示す図ではありません。
          </p>
          <details className="rounded-xl border bg-card p-4">
            <summary className="cursor-pointer font-medium text-mirai-text">
              図の内容を表で見る
            </summary>
            <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
              {layout.nodes.map((node) => (
                <li
                  key={node.id}
                  className="flex justify-between gap-4 border-b py-1"
                >
                  <span>{node.label}</span>
                  <span className="tabular-nums">
                    {formatOkuYen(node.valueThousandYen)}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </section>

        <section className="space-y-4" aria-labelledby="recipients-heading">
          <h2
            id="recipients-heading"
            className="text-[22px] font-bold leading-[1.48] text-mirai-text"
          >
            補助金・負担金・交付金の行き先
          </h2>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            「負担金補助及び交付金」の内訳です。公式の一覧{recipientCount}
            件、合計{formatOkuYen(recipientAmount)}
            を掲載しています。「申請者」は、個人や事業者などの申請者へ交付したものをまとめた表記です。
          </p>
          <SpendingRecipientExplorer recipients={data.recipients} />
        </section>

        <section className="space-y-3" aria-labelledby="sources-heading">
          <h2
            id="sources-heading"
            className="text-[22px] font-bold leading-[1.48] text-mirai-text"
          >
            出典（沼津市）
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {data.sources.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-mirai-text underline"
                >
                  {source.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </Container>
    </div>
  );
}
