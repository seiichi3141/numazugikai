import type { Metadata } from "next";
import { SpendingFlowPage } from "@/features/finance/server/components/spending-flow-page";

export const metadata: Metadata = {
  title: "お金の流れ（試作） | みらい議会＠沼津市",
  description:
    "沼津市の一般会計の決算を、歳入から使い道、補助金の行き先まで公式資料からたどれるようにした試作ページです。",
  robots: { index: false },
};

export default async function Page({
  params,
}: {
  params: Promise<{ fiscalYear: string }>;
}) {
  const { fiscalYear } = await params;
  return <SpendingFlowPage fiscalYear={Number(fiscalYear)} />;
}
