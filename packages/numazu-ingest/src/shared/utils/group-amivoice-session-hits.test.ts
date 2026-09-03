import { describe, expect, it } from "vitest";
import { groupAmivoiceSessionHits } from "./group-amivoice-session-hits";

describe("groupAmivoiceSessionHits", () => {
  it("定例会と臨時会を年・回次ごとにまとめ、委員会を除外する", () => {
    expect(
      groupAmivoiceSessionHits([
        {
          vcsv: "v1",
          date: "1990-06-10",
          meetingName: "平成2年第14回定例会",
        },
        {
          vcsv: "v2",
          date: "1990-06-11",
          meetingName: "平成2年第14回定例会",
        },
        {
          vcsv: "v3",
          date: "1990-07-01",
          meetingName: "総務委員会",
        },
      ])
    ).toEqual([
      expect.objectContaining({
        year: 1990,
        sessionNumber: 14,
        kind: "regular",
        hits: [expect.objectContaining({ vcsv: "v1" }), expect.anything()],
      }),
    ]);
  });
});
