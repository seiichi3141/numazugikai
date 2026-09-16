import type { Metadata } from "next";
import { GeneralQuestionsPage } from "@/features/general-questions/server/components/general-questions-page";

export const metadata: Metadata = {
  title: "一般質問 | みらい議会＠沼津市",
  description: "沼津市議会の一般質問を会期・開催日・質問項目から確認できます。",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    session?: string;
    year?: string;
    questionKind?: string;
    topic?: string;
    role?: string;
  }>;
}) {
  return <GeneralQuestionsPage filters={await searchParams} />;
}
