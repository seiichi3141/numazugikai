import { parsePageParam } from "@mirai-gikai/shared/pagination/page-math";
import { BillList } from "@/features/bills/server/components/bill-list/bill-list";
import { billsListHref } from "@/features/bills/shared/utils/bills-list-href";
import { parseBillSortParams } from "@/features/bills/shared/utils/parse-bill-sort-params";

interface BillsPageProps {
  searchParams: Promise<{
    sort?: string;
    order?: string;
    page?: string;
  }>;
}

export default async function BillsPage({ searchParams }: BillsPageProps) {
  const { sort, order, page } = await searchParams;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">議案管理</h1>
        <p className="text-gray-600 mt-1">議案の一覧を確認・管理できます</p>
      </div>

      <BillList
        sortConfig={parseBillSortParams(sort, order)}
        currentPage={parsePageParam(page)}
        // ページを送っても並び替えを落とさない。
        buildHref={(nextPage) => billsListHref({ sort, order, page: nextPage })}
      />
    </div>
  );
}
