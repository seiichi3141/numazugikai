import { describe, expect, it } from "vitest";
import { chatBillName } from "./chat-bill-name";

const bill = (name: string, title?: string) =>
  ({
    name,
    bill_content: title === undefined ? undefined : ({ title } as never),
  }) as Parameters<typeof chatBillName>[0];

describe("chatBillName", () => {
  it("タイトルと正式名称を併記する", () => {
    expect(
      chatBillName(
        bill(
          "沼津市国民健康保険税条例の…改正する条例",
          "保険料の負担を軽くする"
        )
      )
    ).toBe("保険料の負担を軽くする（沼津市国民健康保険税条例の…改正する条例）");
  });

  // テンプレート文字列に直接埋めると "undefined（…）" が LLM の文脈に入る。
  it("bill_content が無ければ正式名称だけにする", () => {
    expect(chatBillName(bill("沼津市国民健康保険税条例の…改正する条例"))).toBe(
      "沼津市国民健康保険税条例の…改正する条例"
    );
  });

  it("タイトルが空文字なら正式名称だけにする", () => {
    expect(
      chatBillName(bill("沼津市国民健康保険税条例の…改正する条例", ""))
    ).toBe("沼津市国民健康保険税条例の…改正する条例");
  });
});
