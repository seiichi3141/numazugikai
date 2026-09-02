export type CouncilSession = {
  id: string;
  name: string;
  slug: string | null;
  source_url: string | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/** 一覧に出す会期。公開済みの議案数を持つ。 */
export type CouncilSessionSummary = CouncilSession & {
  publishedBillCount: number;
};
