import { FiscalDataQaPage } from "@/features/fiscal-data/server/components/fiscal-data-qa-page";
import { parseFiscalDataPage } from "@/features/fiscal-data/shared/utils/parse-fiscal-data-page";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const query = await searchParams;
  return <FiscalDataQaPage page={parseFiscalDataPage(query.page)} />;
}
