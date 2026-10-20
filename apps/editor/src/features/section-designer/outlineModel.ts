// The outline (layers panel) as flat rows, and how a pointer position over a row maps to a place
// in the tree. Kept free of React and dnd-kit so drop behaviour is unit-tested.
import type { Node, SectionDefinition } from "@strata/schema";
import { childList, describeNode, findNode, isContainer, locate, type Location } from "./tree";

export interface RowRef {
  nodeId: string;
  /** Set for the per-column rows under a Columns node. */
  column?: number;
}

export interface OutlineRow extends RowRef {
  key: string;
  depth: number;
  label: string;
  node: Node;
  /** Whether the row has child rows (containers with children, columns rows). */
  hasChildren: boolean;
}

export type DropZone = "before" | "after" | "inside";

export function rowKey(ref: RowRef): string {
  return ref.column === undefined ? ref.nodeId : `${ref.nodeId}#${String(ref.column)}`;
}

export function parseRowKey(key: string): RowRef {
  const [nodeId = "", column] = key.split("#");
  return column === undefined ? { nodeId } : { nodeId, column: Number(column) };
}

export function outlineRows(definition: SectionDefinition): OutlineRow[] {
  const rows: OutlineRow[] = [];
  const visit = (node: Node, depth: number) => {
    if (node.$type === "columns") {
      rows.push({ key: node.id, nodeId: node.id, depth, label: describeNode(node), node, hasChildren: true });
      node.columns.forEach((column, index) => {
        rows.push({
          key: rowKey({ nodeId: node.id, column: index }),
          nodeId: node.id,
          column: index,
          depth: depth + 1,
          label: `Column ${String(index + 1)}`,
          node,
          hasChildren: column.children.length > 0,
        });
        for (const child of column.children) visit(child, depth + 2);
      });
      return;
    }
    const children = childList(node) ?? [];
    rows.push({
      key: node.id,
      nodeId: node.id,
      depth,
      label: describeNode(node),
      node,
      hasChildren: children.length > 0,
    });
    for (const child of children) visit(child, depth + 1);
  };
  visit(definition.root, 0);
  return rows;
}

/**
 * Which part of a row the pointer is over (`fraction` = 0 at the top edge, 1 at the bottom).
 * Containers accept drops inside through their middle; leaves split into before/after.
 */
export function zoneFor(definition: SectionDefinition, ref: RowRef, fraction: number): DropZone {
  const node = findNode(definition, ref.nodeId);
  if (!node || ref.column !== undefined || node.$type === "section") return "inside";
  if (isContainer(node)) return fraction < 0.25 ? "before" : fraction > 0.75 ? "after" : "inside";
  return fraction < 0.5 ? "before" : "after";
}

/** The tree location a drop in `zone` of a row means. */
export function dropLocation(
  definition: SectionDefinition,
  ref: RowRef,
  zone: DropZone,
): Location | undefined {
  const node = findNode(definition, ref.nodeId);
  if (!node) return undefined;

  if (ref.column !== undefined) {
    return {
      container: { parentId: node.id, column: ref.column },
      index: childList(node, ref.column)?.length ?? 0,
    };
  }
  if (node.$type === "section") {
    return { container: { parentId: node.id }, index: zone === "before" ? 0 : node.children.length };
  }

  const location = locate(definition, node.id);
  if (zone === "before") return location;
  const children = node.$type === "columns" ? undefined : childList(node);
  if (zone === "inside" || (children !== undefined && children.length > 0)) {
    // "After" an expanded container visually sits above its first child, so it means "first inside".
    if (node.$type === "columns")
      return { container: { parentId: node.id, column: 0 }, index: childList(node, 0)?.length ?? 0 };
    if (children !== undefined)
      return { container: { parentId: node.id }, index: zone === "inside" ? children.length : 0 };
  }
  return location ? { container: location.container, index: location.index + 1 } : undefined;
}
