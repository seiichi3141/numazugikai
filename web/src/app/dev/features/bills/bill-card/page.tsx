import { BillCard } from "@/features/bills/client/components/bill-list/bill-card";
import { ComponentShowcase } from "../../../_components/component-showcase";
import { PreviewSection } from "../../../_components/preview-section";
import { allBillStatuses, createMockBill } from "../../../_lib/mock-data";

const SAMPLE_THUMBNAIL = "/img/sample-bill-thumbnail.webp";

export default function BillCardPreview() {
  const defaultBill = createMockBill({
    thumbnail_url: SAMPLE_THUMBNAIL,
  });

  const featuredBill = createMockBill({
    id: "mock-featured",
    is_featured: true,
    thumbnail_url: SAMPLE_THUMBNAIL,
    bill_content: {
      id: "mock-content-featured",
      bill_id: "mock-featured",
      title: "注目の議案タイトル",
      summary:
        "注目フラグが立っている議案のカード表示。注目バッジが表示されます。",
      content: "",
      difficulty_level: "normal",
      created_at: "2026-02-15T00:00:00Z",
      updated_at: "2026-02-15T00:00:00Z",
    },
    tags: [
      { id: "tag-1", label: "経済" },
      { id: "tag-2", label: "デジタル" },
      { id: "tag-3", label: "行政改革" },
    ],
  });

  const longTitleBill = createMockBill({
    id: "mock-long-title",
    thumbnail_url: SAMPLE_THUMBNAIL,
    bill_content: {
      id: "mock-content-long-title",
      bill_id: "mock-long-title",
      title:
        "デジタル社会の形成を図るための関係法律の整備に関する法律の一部を改正する法律案についての補足的な検討事項を含む修正案",
      summary:
        "この議案は開発プレビュー用のサンプルデータです。議案の要約文がここに表示されます。",
      content: "",
      difficulty_level: "normal",
      created_at: "2026-02-15T00:00:00Z",
      updated_at: "2026-02-15T00:00:00Z",
    },
  });

  const longDescriptionBill = createMockBill({
    id: "mock-long-desc",
    thumbnail_url: SAMPLE_THUMBNAIL,
    bill_content: {
      id: "mock-content-long-desc",
      bill_id: "mock-long-desc",
      title: "サンプル議案のタイトル",
      summary:
        "この議案は、市役所の手続をオンラインでも行えるようにするため、申請様式の見直し、コンビニ交付の対象証明書の追加、窓口での本人確認方法の拡大、個人情報の取扱いに関する規定の整備、システム改修に伴う手数料の改定など、関係する複数の条例を一括して改正するものです。高齢の方や障害のある方を含め、これまでどおり窓口でも手続できる体制は維持したうえで、市民の来庁負担を減らすことを目指しています。",
      content: "",
      difficulty_level: "normal",
      created_at: "2026-02-15T00:00:00Z",
      updated_at: "2026-02-15T00:00:00Z",
    },
  });

  return (
    <>
      <h1 className="text-3xl font-bold text-mirai-text mb-8">BillCard</h1>

      <ComponentShowcase title="Default" description="基本的な議案カード">
        <PreviewSection label="通常表示">
          <BillCard bill={defaultBill} />
        </PreviewSection>
      </ComponentShowcase>

      <ComponentShowcase title="Featured" description="注目バッジ付き">
        <PreviewSection label="is_featured: true">
          <BillCard bill={featuredBill} />
        </PreviewSection>
      </ComponentShowcase>

      <ComponentShowcase
        title="Long Title"
        description="タイトルが長い場合の表示"
      >
        <PreviewSection label="長いタイトル">
          <BillCard bill={longTitleBill} />
        </PreviewSection>
      </ComponentShowcase>

      <ComponentShowcase
        title="Long Description"
        description="要約文が長い場合の表示（132文字で切り詰め）"
      >
        <PreviewSection label="長い要約文">
          <BillCard bill={longDescriptionBill} />
        </PreviewSection>
      </ComponentShowcase>

      <ComponentShowcase
        title="All Statuses"
        description="全議案ステータスの表示"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {allBillStatuses.map((status) => (
            <PreviewSection key={status} label={`status: ${status}`}>
              <BillCard
                bill={createMockBill({
                  id: `mock-${status}`,
                  status,
                  thumbnail_url: SAMPLE_THUMBNAIL,
                })}
              />
            </PreviewSection>
          ))}
        </div>
      </ComponentShowcase>
    </>
  );
}
