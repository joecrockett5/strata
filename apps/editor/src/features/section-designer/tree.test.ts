import type { ChildNode, SectionDefinition } from "@strata/schema";
import { produce } from "immer";
import { describe, expect, it } from "vitest";
import { createPrimitive, cloneWithFreshNames } from "./primitives";
import { sample } from "./testSupport";
import {
  canPlace,
  findNode,
  indent,
  insertNode,
  locate,
  moveBy,
  moveNode,
  outdent,
  removeNode,
} from "./tree";

const ids = (def: SectionDefinition) => def.root.children.map((c) => c.id);

describe("primitives", () => {
  it("get unique ids and slot keys", () => {
    const def = sample();
    const extra = createPrimitive("heading", def);
    expect(extra.id).toBe("heading-2");
    expect(extra.$type === "heading" && extra.text.key).toBe("heading2");
  });

  it("clones a subtree with fresh names", () => {
    const def = sample();
    const columns = findNode(def, "columns-1") as ChildNode;
    const copy = cloneWithFreshNames(columns, def);
    expect(copy.id).toBe("columns-2");
    expect(copy.$type === "columns" && copy.columns[0].children[0]?.id).toBe("image-2");
  });
});

describe("tree operations", () => {
  it("moves a node into a column and back out", () => {
    const def = produce(sample(), (d) => {
      expect(moveNode(d, "heading-1", { container: { parentId: "columns-1", column: 1 }, index: 0 })).toBe(
        true,
      );
    });
    expect(ids(def)).toEqual(["columns-1", "stack-1"]);
    expect(locate(def, "heading-1")).toEqual({ container: { parentId: "columns-1", column: 1 }, index: 0 });

    const back = produce(def, (d) => {
      expect(outdent(d, "heading-1")).toBe(true);
    });
    expect(ids(back)).toEqual(["columns-1", "heading-1", "stack-1"]);
  });

  it("adjusts the index when moving down within the same list", () => {
    const def = produce(sample(), (d) => {
      moveNode(d, "heading-1", { container: { parentId: "root" }, index: 3 });
    });
    expect(ids(def)).toEqual(["columns-1", "stack-1", "heading-1"]);
  });

  it("moves up and down among siblings, refusing to leave the list", () => {
    const def = produce(sample(), (d) => {
      expect(moveBy(d, "stack-1", -1)).toBe(true);
      expect(moveBy(d, "heading-1", -1)).toBe(false);
    });
    expect(ids(def)).toEqual(["heading-1", "stack-1", "columns-1"]);
  });

  it("indents into the previous container (last column for Columns)", () => {
    const def = produce(sample(), (d) => {
      expect(indent(d, "stack-1")).toBe(true);
      expect(indent(d, "heading-1")).toBe(false); // nothing before it
    });
    expect(locate(def, "stack-1")?.container).toEqual({ parentId: "columns-1", column: 1 });
  });

  it("never moves a node into its own subtree", () => {
    const def = sample();
    expect(canPlace(def, "stack", { parentId: "stack-1" }, "stack-1")).toBe(false);
    expect(canPlace(def, "columns", { parentId: "columns-1", column: 0 }, "columns-1")).toBe(false);
  });

  it("does not offer drops the server would reject", () => {
    let def = sample();
    def = produce(def, (d) => {
      insertNode(d, { container: { parentId: "root" }, index: 0 }, createPrimitive("repeater", d));
      insertNode(d, { container: { parentId: "root" }, index: 0 }, createPrimitive("nav", d));
    });
    expect(canPlace(def, "repeater", { parentId: "repeater-1" })).toBe(false);
    expect(canPlace(def, "contactForm", { parentId: "repeater-1" })).toBe(false);
    expect(canPlace(def, "nav", { parentId: "root" })).toBe(false); // already has one
    expect(canPlace(def, "heading", { parentId: "repeater-1" })).toBe(true);
    expect(canPlace(def, "section", { parentId: "root" })).toBe(false);
  });

  it("removes nodes", () => {
    const def = produce(sample(), (d) => {
      expect(removeNode(d, "image-1")?.id).toBe("image-1");
    });
    expect(findNode(def, "image-1")).toBeUndefined();
  });
});
