import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/interview/chat", () => {
  it("AIインタビューが無効な場合は404を返す", async () => {
    const request = new Request("http://localhost/api/interview/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ billId: "bill-1", messages: [] }),
    });

    const response = await POST(request);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "AI interview is not available on this site",
    });
  });
});
