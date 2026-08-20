import { describe, expect, it } from "vitest";

import { chooseProgressUpdateStrategy } from "../../src/lib/progressUpdateStrategy";

describe("chooseProgressUpdateStrategy", () => {
  it("uses the fast path for a normal submission without an explicit historical date", () => {
    expect(chooseProgressUpdateStrategy(undefined, 100)).toBe("fast-path");
  });

  it("uses the fast path only when an explicit date is strictly newer", () => {
    expect(chooseProgressUpdateStrategy(101, 100)).toBe("fast-path");
  });

  it("rebuilds retroactive and tied entries deterministically", () => {
    expect(chooseProgressUpdateStrategy(99, 100)).toBe("rebuild");
    expect(chooseProgressUpdateStrategy(100, 100)).toBe("rebuild");
  });

  it("rebuilds explicitly dated legacy services without a watermark", () => {
    expect(chooseProgressUpdateStrategy(100, null)).toBe("rebuild");
  });
});
