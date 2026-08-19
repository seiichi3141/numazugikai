import { describe, expect, it } from "vitest";
import {
  BILL_CATEGORY_LABELS,
  BILL_STATUS_LABELS,
  BILL_STATUS_ORDER,
  BILL_SUBMITTER_LABELS,
  type BillStatusEnum,
  getBillStatusLabel,
  isConcludedStatus,
} from "./index";

describe("getBillStatusLabel", () => {
  it("市議会の議決結果を日本語にする", () => {
    expect(getBillStatusLabel("passed")).toBe("可決");
    expect(getBillStatusLabel("rejected")).toBe("否決");
    expect(getBillStatusLabel("consented")).toBe("同意");
    expect(getBillStatusLabel("approved")).toBe("承認");
    expect(getBillStatusLabel("certified")).toBe("認定");
  });

  it("請願・陳情の結果を日本語にする", () => {
    expect(getBillStatusLabel("adopted")).toBe("採択");
    expect(getBillStatusLabel("not_adopted")).toBe("不採択");
  });

  it("審議の途中段階も日本語にする", () => {
    expect(getBillStatusLabel("preparing")).toBe("準備中");
    expect(getBillStatusLabel("submitted")).toBe("提出");
    expect(getBillStatusLabel("in_committee")).toBe("委員会で審査中");
    expect(getBillStatusLabel("continued")).toBe("継続審査");
  });

  it("すべてのステータスにラベルがある", () => {
    for (const status of Object.keys(BILL_STATUS_LABELS) as BillStatusEnum[]) {
      expect(getBillStatusLabel(status)).not.toBe("");
      expect(getBillStatusLabel(status)).not.toBe(status);
    }
  });
});

describe("BILL_STATUS_ORDER", () => {
  it("結論が出た議案を、審議中の議案より前に並べる", () => {
    expect(BILL_STATUS_ORDER.passed).toBeLessThan(
      BILL_STATUS_ORDER.in_committee
    );
    expect(BILL_STATUS_ORDER.rejected).toBeLessThan(
      BILL_STATUS_ORDER.submitted
    );
  });

  it("準備中を最後に置く", () => {
    const values = Object.values(BILL_STATUS_ORDER);
    expect(BILL_STATUS_ORDER.preparing).toBe(Math.max(...values));
  });

  it("すべてのステータスに重複しない順序を割り当てる", () => {
    const values = Object.values(BILL_STATUS_ORDER);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("isConcludedStatus", () => {
  it("議決が確定した議案を判定する", () => {
    expect(isConcludedStatus("passed")).toBe(true);
    expect(isConcludedStatus("rejected")).toBe(true);
    expect(isConcludedStatus("reported")).toBe(true);
  });

  it("審議中の議案は確定扱いにしない", () => {
    expect(isConcludedStatus("preparing")).toBe(false);
    expect(isConcludedStatus("submitted")).toBe(false);
    expect(isConcludedStatus("in_committee")).toBe(false);
  });
});

describe("分類・提出者のラベル", () => {
  it("地方自治法の区分に対応する分類名を持つ", () => {
    expect(BILL_CATEGORY_LABELS.ordinance).toBe("条例");
    expect(BILL_CATEGORY_LABELS.budget).toBe("予算");
    expect(BILL_CATEGORY_LABELS.personnel).toBe("人事");
    expect(BILL_CATEGORY_LABELS.petition).toBe("請願・陳情");
  });

  it("市議会の提出者を表す", () => {
    expect(BILL_SUBMITTER_LABELS.mayor).toBe("市長");
    expect(BILL_SUBMITTER_LABELS.member).toBe("議員");
    expect(BILL_SUBMITTER_LABELS.citizen).toBe("市民");
  });
});
