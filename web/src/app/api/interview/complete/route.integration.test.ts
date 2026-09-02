import { describe, expect, it } from "vitest";
import { POST } from "./route";

function buildCompleteRequest(body: unknown): Request {
  return new Request("http://localhost/api/interview/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/interview/complete", () => {
  it("AIインタビューが無効な場合は404を返す", async () => {
    const res = await POST(
      buildCompleteRequest({
        sessionId: "session-1",
        isPublic: true,
        isDataReuseConsented: true,
      })
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: "AI interview is not available on this site",
    });
  });
});
