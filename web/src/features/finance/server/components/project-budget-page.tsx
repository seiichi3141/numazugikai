import "server-only";
import { notFound } from "next/navigation";
import { Container } from "@/components/layouts/container";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { routes } from "@/lib/routes";
import { ProjectBudgetExplorer } from "../../client/components/project-budget-explorer";
import {
  buildProjectRows,
  summarizeProjectCoverage,
} from "../../shared/utils/build-project-rows";
import { formatOkuYen } from "../../shared/utils/build-spending-flow";
import { formatFiscalYear } from "../../shared/utils/format-fiscal-year";
import {
  calculateSharePercent,
  formatSharePercent,
  formatThousandYen,
} from "../../shared/utils/format-yen";
import { getProjectBudget } from "../loaders/get-project-budget";
import { getSpendingFlow } from "../loaders/get-spending-flow";

const THOUSAND = 1000;

function percent(part: number, whole: number): string {
  return formatSharePercent(calculateSharePercent(`${part}`, `${whole}`));
}

export function ProjectBudgetPage({ fiscalYear }: { fiscalYear: number }) {
  const data = getProjectBudget(fiscalYear);
  const flow = getSpendingFlow(fiscalYear);
  if (!data || !flow) notFound();

  const rows = buildProjectRows(data, flow.recipients);
  const coverage = summarizeProjectCoverage(data, flow.recipients);
  const purposes = [...new Set(data.items.map((item) => item.purpose))];
  const sources = [
    ...new Map(
      [...data.sources, ...flow.sources].map((source) => [source.url, source])
    ).values(),
  ];
  const yearLabel = formatFiscalYear(fiscalYear);
  const coverageCards = [
    {
      label: "補助金・負担金・交付金",
      value: percent(
        coverage.linkedRecipientThousandYen,
        coverage.recipientThousandYen
      ),
      detail: `${coverage.recipientCount}件のうち${coverage.linkedRecipientCount}件、${formatOkuYen(coverage.linkedRecipientThousandYen)}が事業と結び付きました（推定）`,
    },
    {
      label: "随意契約",
      value: percent(coverage.linkedContractYen, coverage.contractYen),
      detail: `${coverage.contractCount}件のうち${coverage.linkedContractCount}件、${formatOkuYen(coverage.linkedContractYen / THOUSAND)}が事業と結び付きました（推定）`,
    },
    {
      label: "主要建設事業の決算",
      value: `${coverage.constructionCount}事業`,
      detail: `合計${formatOkuYen(coverage.settledThousandYen)}。これ以外の事業の決算額は一覧になっていません`,
    },
  ];

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
            { label: "事業の予算と実績" },
          ]}
        />
        <header className="space-y-2">
          <p className="text-sm font-bold text-mirai-text-secondary">試作</p>
          <h1 className="text-3xl font-bold text-mirai-text">
            {yearLabel}の事業の予算と実績
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            当初予算の事業ごとに、公式資料で分かる決算や行き先を並べました。本サービスは非公式であり、正式な内容は各公式資料をご確認ください。
          </p>
        </header>

        <section className="space-y-4" aria-labelledby="coverage-heading">
          <h2
            id="coverage-heading"
            className="text-[22px] font-bold leading-[1.48] text-mirai-text"
          >
            どこまでたどれるか
          </h2>
          <ul className="grid gap-3 md:grid-cols-3">
            {coverageCards.map((card) => (
              <li key={card.label} className="rounded-xl border bg-card p-4">
                <p className="text-sm text-mirai-text-secondary">
                  {card.label}
                </p>
                <p className="text-2xl font-bold tabular-nums text-mirai-text">
                  {card.value}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {card.detail}
                </p>
              </li>
            ))}
          </ul>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            予算の事業と補助金・契約の間に共通の番号はありません。名称の近さで結び付けた推定であり、市の公式な対応関係ではありません。誤りが含まれることがあり、該当するものがなくても事業に実績がないという意味ではありません。
          </p>
        </section>

        <section className="space-y-4" aria-labelledby="projects-heading">
          <h2
            id="projects-heading"
            className="text-[22px] font-bold leading-[1.48] text-mirai-text"
          >
            事業を探す
          </h2>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            一般会計の当初予算
            {formatOkuYen(data.budgetTotalThousandYen)}
            のうち、内容が分かる{coverage.itemCount}行、
            {formatOkuYen(coverage.budgetThousandYen)}
            です。人件費と物件費のほか、公債費の元金や繰出金など内訳の行がないものは含みません。契約額には翌年度分、見込額や想定額が含まれることがあり、決算額とは一致しません。
          </p>
          <ProjectBudgetExplorer rows={rows} purposes={purposes} />
        </section>

        <section className="space-y-4" aria-labelledby="construction-heading">
          <h2
            id="construction-heading"
            className="text-[22px] font-bold leading-[1.48] text-mirai-text"
          >
            主要建設事業の予算と決算
          </h2>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            予算は当初予算、決算は市政報告書の附表の金額です。補正予算や繰越があり、同じ名称でも予算と決算で含む範囲が違う場合があるため、差額がそのまま使い残しや超過を意味するわけではありません。
          </p>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b text-left text-mirai-text-secondary">
                  <th className="p-3 font-medium">事業</th>
                  <th className="p-3 text-right font-medium">当初予算</th>
                  <th className="p-3 text-right font-medium">決算</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.constructions.map((row) => (
                  <tr key={row.name}>
                    <td className="p-3 text-mirai-text">{row.name}</td>
                    <td className="p-3 text-right tabular-nums">
                      {row.budgetThousandYen === null
                        ? "—"
                        : formatThousandYen(row.budgetThousandYen)}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {formatThousandYen(row.settledThousandYen)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3" aria-labelledby="project-sources">
          <h2
            id="project-sources"
            className="text-[22px] font-bold leading-[1.48] text-mirai-text"
          >
            出典（沼津市）
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {sources.map((source) => (
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
