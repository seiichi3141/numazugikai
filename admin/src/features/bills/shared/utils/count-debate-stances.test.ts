import { describe, expect, it } from "vitest";
import { countDebateStances } from "../types";

describe("countDebateStances", () => {
  it("賛成と反対を分けて数える", () => {
    expect(
      countDebateStances([
        { stance: "against" },
        { stance: "for" },
        { stance: "against" },
      ])
    ).toEqual({ for: 1, against: 2, total: 3 });
  });

  it("討論がなければすべて0", () => {
    expect(countDebateStances([])).toEqual({ for: 0, against: 0, total: 0 });
  });

  it("賛成討論だけの議案も数える", () => {
    // 議第3号のように、反対はないが賛成討論が行われた議案がある
    expect(countDebateStances([{ stance: "for" }, { stance: "for" }])).toEqual({
      for: 2,
      against: 0,
      total: 2,
    });
  });
});
