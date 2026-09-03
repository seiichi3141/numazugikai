import type { Metadata } from "next";
import { GeneralQuestionSessionPage } from "@/features/general-questions/server/components/general-question-session-page";

type Props = { params: Promise<{ sessionSlug: string }> };
export const metadata: Metadata = {
  title: "会期別の一般質問 | みらい議会＠沼津市",
};
export default async function Page({ params }: Props) {
  const { sessionSlug } = await params;
  return <GeneralQuestionSessionPage slug={sessionSlug} />;
}
