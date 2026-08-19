import { describe, expect, it } from "vitest";
import { stripHonorific } from "./ingest-members";

describe("stripHonorific", () => {
  it("議会中継APIの表記から敬称を落とす", () => {
    expect(stripHonorific("浅原和美議員")).toBe("浅原和美");
    expect(stripHonorific("市川道隆議員")).toBe("市川道隆");
  });

  it("議長・副議長・市長の肩書も落とす", () => {
    expect(stripHonorific("梶 泰久議長")).toBe("梶 泰久");
    expect(stripHonorific("賴重秀一市長")).toBe("賴重秀一");
    expect(stripHonorific("𠮷澤勇一郎副市長")).toBe("𠮷澤勇一郎");
  });

  it("姓名の間の空白は残す", () => {
    expect(stripHonorific("小澤　隆議員")).toBe("小澤　隆");
  });

  it("肩書がなければそのまま返す", () => {
    expect(stripHonorific("浅原和美")).toBe("浅原和美");
  });
});
