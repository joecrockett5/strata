import { describe, expect, it } from "vitest";
import { dropLocation, outlineRows, parseRowKey, rowKey, zoneFor } from "./outlineModel";
import { sample } from "./testSupport";

describe("outline rows", () => {
  it("flattens the tree with a row per column", () => {
    const rows = outlineRows(sample());
    expect(rows.map((r) => [r.key, r.depth])).toEqual([
      ["root", 0],
      ["heading-1", 1],
      ["columns-1", 1],
      ["columns-1#0", 2],
      ["image-1", 3],
      ["columns-1#1", 2],
      ["stack-1", 1],
      ["richText-1", 2],
    ]);
    expect(rows.find((r) => r.key === "columns-1#1")?.hasChildren).toBe(false);
  });

  it("round-trips row keys", () => {
    expect(parseRowKey(rowKey({ nodeId: "columns-1", column: 1 }))).toEqual({
      nodeId: "columns-1",
      column: 1,
    });
    expect(parseRowKey(rowKey({ nodeId: "stack-1" }))).toEqual({ nodeId: "stack-1" });
  });
});

describe("drop zones", () => {
  const def = sample();

  it("splits leaves in halves and containers in quarters", () => {
    expect(zoneFor(def, { nodeId: "heading-1" }, 0.4)).toBe("before");
    expect(zoneFor(def, { nodeId: "heading-1" }, 0.6)).toBe("after");
    expect(zoneFor(def, { nodeId: "stack-1" }, 0.1)).toBe("before");
    expect(zoneFor(def, { nodeId: "stack-1" }, 0.5)).toBe("inside");
    expect(zoneFor(def, { nodeId: "stack-1" }, 0.9)).toBe("after");
    expect(zoneFor(def, { nodeId: "columns-1", column: 1 }, 0.1)).toBe("inside");
    expect(zoneFor(def, { nodeId: "root" }, 0.1)).toBe("inside");
  });

  it("maps zones to tree locations", () => {
    expect(dropLocation(def, { nodeId: "heading-1" }, "before")).toEqual({
      container: { parentId: "root" },
      index: 0,
    });
    expect(dropLocation(def, { nodeId: "heading-1" }, "after")).toEqual({
      container: { parentId: "root" },
      index: 1,
    });
    expect(dropLocation(def, { nodeId: "columns-1", column: 1 }, "inside")).toEqual({
      container: { parentId: "columns-1", column: 1 },
      index: 0,
    });
    expect(dropLocation(def, { nodeId: "columns-1" }, "inside")).toEqual({
      container: { parentId: "columns-1", column: 0 },
      index: 1,
    });
    expect(dropLocation(def, { nodeId: "stack-1" }, "inside")).toEqual({
      container: { parentId: "stack-1" },
      index: 1,
    });
    expect(dropLocation(def, { nodeId: "root" }, "inside")).toEqual({
      container: { parentId: "root" },
      index: 3,
    });
  });

  it("treats 'after' an expanded container as its first child slot", () => {
    expect(dropLocation(def, { nodeId: "stack-1" }, "after")).toEqual({
      container: { parentId: "stack-1" },
      index: 0,
    });
    // Columns rows always have column rows beneath, so 'after' means after the whole node.
    expect(dropLocation(def, { nodeId: "columns-1" }, "after")).toEqual({
      container: { parentId: "root" },
      index: 2,
    });
  });
});
