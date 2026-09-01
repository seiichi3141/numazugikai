import { getReportOgData } from "@/features/interview-report/server/loaders/get-report-og-data";
import { OG_COLORS } from "@/lib/og/og-colors";
import { renderOgImage } from "@/lib/og/render-og-image";
import { truncateText } from "@/lib/utils/truncate-text";

/**
 * OGP画像のテキスト制限
 */
const OG_SUMMARY_MAX_LENGTH = 100;
const OG_BILL_NAME_MAX_LENGTH = 40;
const OG_BILL_NAME_WIDTH = 820;
const OG_BILL_NAME_MAX_HEIGHT = 96;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const reportId = searchParams.get("id");

  if (!reportId) {
    return new Response("Missing id parameter", { status: 400 });
  }

  // 取得の失敗はローダー側で null に畳まれる
  const data = await getReportOgData(reportId);
  if (!data) {
    return new Response("Report not found", { status: 404 });
  }

  const truncatedSummary = truncateText(data.summary, OG_SUMMARY_MAX_LENGTH);
  const truncatedBillName = truncateText(
    data.billName,
    OG_BILL_NAME_MAX_LENGTH
  );

  return renderOgImage(
    // Satori はフラグメントを展開できないので1つの div で包む
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        width: "100%",
      }}
    >
      {/* サマリーテキスト */}
      <div
        style={{
          display: "flex",
          fontSize: 38,
          lineHeight: 1.8,
          flex: 1,
          width: 740,
          overflow: "hidden",
        }}
      >
        {truncatedSummary}
      </div>

      {/* 議案名 */}
      <div
        style={{
          display: "flex",
          width: OG_BILL_NAME_WIDTH,
          maxHeight: OG_BILL_NAME_MAX_HEIGHT,
          fontSize: 32,
          color: OG_COLORS.primaryAccent,
          lineHeight: 1.5,
          overflow: "hidden",
          // 要約側には付けないこと。文章ブロック2つに break-all が付くと
          // Satori の改行処理が無限ループする（bill ルート参照）
          wordBreak: "break-all",
        }}
      >
        {truncatedBillName}
      </div>
    </div>
  );
}
