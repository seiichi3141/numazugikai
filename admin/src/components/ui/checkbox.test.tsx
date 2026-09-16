// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { Checkbox } from "./checkbox";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.assign(globalThis, {
  React,
  ResizeObserver: ResizeObserverStub,
  IS_REACT_ACT_ENVIRONMENT: true,
});

describe("Checkbox", () => {
  it("チェック済みの値だけをFormDataへ含める", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <form aria-label="政策分野">
          <Checkbox
            id="topic-a"
            name="topicId"
            value="topic-a"
            defaultChecked
          />
          <label htmlFor="topic-a">分野A</label>
          <Checkbox id="topic-b" name="topicId" value="topic-b" />
          <label htmlFor="topic-b">分野B</label>
        </form>
      );
    });
    const form = container.querySelector("form");
    const [topicA, topicB] =
      container.querySelectorAll<HTMLButtonElement>('[role="checkbox"]');
    if (!(form && topicA && topicB)) {
      throw new Error("テスト対象のフォーム要素を取得できませんでした");
    }

    expect(new FormData(form).getAll("topicId")).toEqual(["topic-a"]);

    await act(async () => topicB.click());
    expect(new FormData(form).getAll("topicId")).toEqual([
      "topic-a",
      "topic-b",
    ]);

    await act(async () => topicA.click());
    expect(new FormData(form).getAll("topicId")).toEqual(["topic-b"]);

    await act(async () => root.unmount());
    container.remove();
  });
});
