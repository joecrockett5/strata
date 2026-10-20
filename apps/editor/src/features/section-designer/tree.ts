// Pure operations on a section definition tree. Used by drag and drop, the outline's buttons and
// keyboard shortcuts alike, so every move goes through the same rules. Functions mutate their
// argument (they run inside Immer recipes) and return whether anything changed.
import {
  type ChildNode,
  type Node,
  type PrimitiveType,
  type SectionDefinition,
  walkDefinition,
} from "@strata/schema";

/** A place children can go: a section/stack/repeater's children, or one column of a Columns node. */
export interface ContainerRef {
  parentId: string;
  column?: number;
}

export interface Location {
  container: ContainerRef;
  index: number;
}

export function isContainer(node: Node): boolean {
  return (
    node.$type === "section" ||
    node.$type === "stack" ||
    node.$type === "repeater" ||
    node.$type === "columns"
  );
}

/** The child list a container reference points at (undefined if it is not a container). */
export function childList(node: Node, column?: number): ChildNode[] | undefined {
  switch (node.$type) {
    case "section":
    case "stack":
    case "repeater":
      return column === undefined ? node.children : undefined;
    case "columns":
      return column === undefined ? undefined : node.columns[column]?.children;
    default:
      return undefined;
  }
}

/** Every container reference a node offers (columns offer one per column). */
export function containersOf(node: Node): ContainerRef[] {
  if (node.$type === "columns") return node.columns.map((_, column) => ({ parentId: node.id, column }));
  return isContainer(node) ? [{ parentId: node.id }] : [];
}

export function findNode(definition: SectionDefinition, id: string): Node | undefined {
  for (const { node } of walkDefinition(definition)) {
    if (node.id === id) return node;
  }
  return undefined;
}

/** Where a node sits; undefined for the root or an unknown id. */
export function locate(definition: SectionDefinition, id: string): Location | undefined {
  for (const { node } of walkDefinition(definition)) {
    for (const container of containersOf(node)) {
      const index = childList(node, container.column)?.findIndex((child) => child.id === id) ?? -1;
      if (index >= 0) return { container, index };
    }
  }
  return undefined;
}

function listAt(definition: SectionDefinition, container: ContainerRef): ChildNode[] | undefined {
  const parent = findNode(definition, container.parentId);
  return parent ? childList(parent, container.column) : undefined;
}

function contains(ancestor: Node, id: string): boolean {
  if (ancestor.id === id) return true;
  const lists = containersOf(ancestor).map((c) => childList(ancestor, c.column) ?? []);
  return lists.some((list) => list.some((child) => contains(child, id)));
}

/** Ids of nodes (including the container itself) whose subtree contains the container. */
function insideRepeater(definition: SectionDefinition, containerId: string): boolean {
  for (const { node, repeater } of walkDefinition(definition)) {
    if (node.id === containerId) return node.$type === "repeater" || repeater !== undefined;
  }
  return false;
}

/**
 * Whether a node of `type` (optionally the existing node `nodeId`) may be placed in `container`.
 * Mirrors the server's definition rules so the UI never offers a drop that cannot be published.
 */
export function canPlace(
  definition: SectionDefinition,
  type: PrimitiveType,
  container: ContainerRef,
  nodeId?: string,
): boolean {
  if (type === "section") return false;
  const parent = findNode(definition, container.parentId);
  if (!parent || !childList(parent, container.column)) return false;
  if (nodeId) {
    const moving = findNode(definition, nodeId);
    if (!moving || contains(moving, container.parentId)) return false;
    if (insideRepeater(definition, container.parentId) && hasType(moving, ["repeater", "nav", "contactForm"]))
      return false;
  }
  if (
    insideRepeater(definition, container.parentId) &&
    (type === "repeater" || type === "nav" || type === "contactForm")
  ) {
    return false;
  }
  if ((type === "nav" || type === "contactForm") && !nodeId && countType(definition, type) > 0) return false;
  return true;
}

export function hasType(node: Node, types: PrimitiveType[]): boolean {
  if (types.includes(node.$type)) return true;
  return containersOf(node).some((c) =>
    (childList(node, c.column) ?? []).some((child) => hasType(child, types)),
  );
}

function countType(definition: SectionDefinition, type: PrimitiveType): number {
  return [...walkDefinition(definition)].filter(({ node }) => node.$type === type).length;
}

export function insertNode(definition: SectionDefinition, location: Location, node: ChildNode): boolean {
  const list = listAt(definition, location.container);
  if (!list) return false;
  list.splice(Math.max(0, Math.min(location.index, list.length)), 0, node);
  return true;
}

export function removeNode(definition: SectionDefinition, id: string): ChildNode | undefined {
  const location = locate(definition, id);
  if (!location) return undefined;
  return listAt(definition, location.container)?.splice(location.index, 1)[0];
}

/**
 * Moves a node to `target`. `target.index` is the position in the target list *before* the node
 * is removed (what a drop indicator shows), so moving down within the same list adjusts for the gap.
 */
export function moveNode(definition: SectionDefinition, id: string, target: Location): boolean {
  const from = locate(definition, id);
  const node = findNode(definition, id);
  if (!from || !node || node.$type === "section") return false;
  if (!canPlace(definition, node.$type, target.container, id)) return false;

  const sameList =
    from.container.parentId === target.container.parentId &&
    from.container.column === target.container.column;
  let index = target.index;
  if (sameList && from.index < index) index -= 1;
  if (sameList && from.index === index) return false;

  const removed = removeNode(definition, id);
  return removed ? insertNode(definition, { container: target.container, index }, removed) : false;
}

/** Moves a node up (-1) or down (+1) among its siblings. */
export function moveBy(definition: SectionDefinition, id: string, delta: -1 | 1): boolean {
  const from = locate(definition, id);
  const list = from ? listAt(definition, from.container) : undefined;
  if (!from || !list) return false;
  const to = from.index + delta;
  if (to < 0 || to >= list.length) return false;
  const [node] = list.splice(from.index, 1);
  if (!node) return false;
  list.splice(to, 0, node);
  return true;
}

/** Moves a node into the end of its previous sibling, if that sibling is a container. */
export function indent(definition: SectionDefinition, id: string): boolean {
  const from = locate(definition, id);
  const list = from ? listAt(definition, from.container) : undefined;
  const previous = from && list ? list[from.index - 1] : undefined;
  if (!previous || !isContainer(previous)) return false;
  const containers = containersOf(previous);
  const container = containers[containers.length - 1];
  if (!container) return false;
  const length = childList(previous, container.column)?.length ?? 0;
  return moveNode(definition, id, { container, index: length });
}

/** Moves a node out of its container, to just after that container. */
export function outdent(definition: SectionDefinition, id: string): boolean {
  const from = locate(definition, id);
  if (!from || from.container.parentId === definition.root.id) return false;
  const parentLocation = locate(definition, from.container.parentId);
  if (!parentLocation) return false;
  return moveNode(definition, id, { container: parentLocation.container, index: parentLocation.index + 1 });
}

/** A short human label for a node, for the outline. */
export function describeNode(node: Node): string {
  switch (node.$type) {
    case "section":
      return "Section";
    case "heading":
      return `H${node.level} · ${node.text.label}`;
    case "richText":
      return `Rich text · ${node.content.label}`;
    case "image":
      return `Image · ${node.image.label}`;
    case "button":
      return `Button · ${node.label.label}`;
    case "repeater":
      return `Repeater · ${node.itemLabel} (${node.min}–${node.max})`;
    case "columns":
      return `Columns · ${node.columns.length}`;
    case "stack":
      return "Stack";
    case "nav":
      return "Navigation";
    case "contactForm":
      return "Contact form";
    case "spacer":
      return `Spacer · ${node.size}`;
    case "divider":
      return "Divider";
  }
}
