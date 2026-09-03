import { describe, expect, it } from "vitest";
import { GET } from "./route";

function request(query = "") {
  return new Request(
    `http://localhost/api/open-data/general-questions${query}`,
    {
      headers: { "x-forwarded-for": "198.51.100.44" },
    }
  );
}

describe("GET /api/open-data/general-questions", () => {
  it("不正な年を400にする", async () => {
    expect((await GET(request("?year=1989"))).status).toBe(400);
  });

  it("QA済み一覧をno-storeで返す", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(Array.isArray((await response.json()).items)).toBe(true);
  });

  it("CSVをダウンロード形式で返す", async () => {
    const response = await GET(request("?format=csv"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    expect(await response.text()).toContain("appearance_id");
  });
});
