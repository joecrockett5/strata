// Small definitions shared by the section designer's unit tests.
import type { SectionDefinition } from "@strata/schema";
import { produce } from "immer";
import { createPrimitive } from "./primitives";
import { findNode, insertNode } from "./tree";

export function empty(): SectionDefinition {
  return {
    schemaVersion: 1,
    root: {
      $type: "section",
      id: "root",
      background: "background",
      paddingY: "lg",
      width: "standard",
      children: [],
    },
  };
}

/** root: [heading-1, columns-1 [ [image-1], [] ], stack-1 [ text-1 ]] */
export function sample(): SectionDefinition {
  let def = empty();
  const add = (type: Parameters<typeof createPrimitive>[0], parentId = "root", column?: number) => {
    const node = createPrimitive(type, def);
    def = produce(def, (d) => {
      const parent = findNode(d, parentId);
      const length =
        parent && parent.$type === "columns"
          ? (parent.columns[column ?? 0]?.children.length ?? 0)
          : parent && "children" in parent
            ? parent.children.length
            : 0;
      insertNode(
        d,
        { container: column === undefined ? { parentId } : { parentId, column }, index: length },
        node,
      );
    });
    return node;
  };
  add("heading");
  const columns = add("columns");
  add("image", columns.id, 0);
  const stack = add("stack");
  add("richText", stack.id);
  return def;
}
