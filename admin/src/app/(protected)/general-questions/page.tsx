import { GeneralQuestionQaPage } from "@/features/general-questions/server/components/general-question-qa-page";

function positivePage(value: string | string[] | undefined): number {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    qaPage?: string | string[];
    classificationPage?: string | string[];
  }>;
}) {
  const query = await searchParams;
  return (
    <GeneralQuestionQaPage
      qaPage={positivePage(query.qaPage)}
      classificationPage={positivePage(query.classificationPage)}
    />
  );
}
