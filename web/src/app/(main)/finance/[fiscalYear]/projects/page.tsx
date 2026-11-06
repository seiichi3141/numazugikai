import type { Metadata } from "next";
import { ProjectBudgetPage } from "@/features/finance/server/components/project-budget-page";

export const metadata: Metadata = {
  title: "事業の予算と実績（試作） | みらい議会＠沼津市",
  description:
    "沼津市の予算を事業ごとに示し、主要建設事業の決算と、補助金・随意契約の行き先を公式資料からたどれるようにした試作ページです。",
  robots: { index: false },
};

export default async function Page({
  params,
}: {
  params: Promise<{ fiscalYear: string }>;
}) {
  const { fiscalYear } = await params;
  return <ProjectBudgetPage fiscalYear={Number(fiscalYear)} />;
}
