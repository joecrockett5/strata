import type {
  ChildNode,
  ColumnRatio,
  ImageValue,
  Node,
  RepeaterNode,
  SectionDefinition,
  SectionInstance,
  SlotDefinition,
  SlotValue,
} from "./types";

/** Every node in a definition, depth first, with the repeater it sits in (if any). */
export interface WalkedNode {
  node: Node;
  /** JSON pointer into the definition, e.g. `/root/children/0/columns/1/children/0`. */
  path: string;
  repeater: RepeaterNode | undefined;
}

export function* walkDefinition(definition: SectionDefinition): Generator<WalkedNode> {
  yield* walk(definition.root, "/root", undefined);
}

function* walk(node: Node, path: string, repeater: RepeaterNode | undefined): Generator<WalkedNode> {
  yield { node, path, repeater };
  const childRepeater = node.$type === "repeater" ? node : repeater;
  for (const [child, childPath] of childrenWithPaths(node, path)) {
    yield* walk(child, childPath, childRepeater);
  }
}

/** Direct children of a node with their JSON pointers (columns are flattened). */
export function childrenWithPaths(node: Node, path: string): [ChildNode, string][] {
  switch (node.$type) {
    case "section":
    case "stack":
    case "repeater":
      return node.children.map((child, i) => [child, `${path}/children/${i}`]);
    case "columns":
      return node.columns.flatMap((column, c) =>
        column.children.map((child, i): [ChildNode, string] => [child, `${path}/columns/${c}/children/${i}`]),
      );
    default:
      return [];
  }
}

/** Slots owned directly by a node (not its descendants). */
export function ownSlots(node: Node): SlotDefinition[] {
  switch (node.$type) {
    case "section":
      return node.backgroundImage ? [node.backgroundImage] : [];
    case "heading":
      return [node.text];
    case "richText":
      return [node.content];
    case "image":
      return [node.image];
    case "button":
      return [node.label, node.link];
    case "contactForm":
      return [node.submitLabel, node.successMessage];
    default:
      return [];
  }
}

export interface RepeaterCatalog {
  node: RepeaterNode;
  slots: Map<string, SlotDefinition>;
}

/**
 * Index of a definition's slots, mirroring `SlotCatalog` in Strata.Domain: top-level slots are
 * stored in `SectionInstance.values`, repeater slots per item.
 */
export interface SlotCatalog {
  slots: Map<string, SlotDefinition>;
  repeaters: Map<string, RepeaterCatalog>;
}

export function slotCatalog(definition: SectionDefinition): SlotCatalog {
  const slots = new Map<string, SlotDefinition>();
  const repeaters = new Map<string, RepeaterCatalog>();
  for (const { node, repeater } of walkDefinition(definition)) {
    if (node.$type === "repeater" && !repeater) {
      if (!repeaters.has(node.key)) {
        repeaters.set(node.key, { node, slots: new Map() });
      }
      continue;
    }
    const target = repeater ? repeaters.get(repeater.key)?.slots : slots;
    for (const slot of ownSlots(node)) {
      if (target && !target.has(slot.key)) {
        target.set(slot.key, slot);
      }
    }
  }
  return { slots, repeaters };
}

/**
 * The value that renders for a slot: locked slots always use the designer's default; editable
 * slots use the stored value when present.
 */
export function effectiveValue<S extends SlotDefinition>(
  slot: S,
  values: Readonly<Record<string, SlotValue | undefined>> | undefined,
): S["default"] {
  if (slot.mode === "locked") {
    return slot.default;
  }
  const value = values?.[slot.key];
  return value && value.$type === slot.default.$type ? value : slot.default;
}

export function columnRatioParts(ratio: ColumnRatio): number[] {
  return ratio.split(":").map(Number);
}

/** True when an image value points at an actual uploaded file. */
export function hasMedia(image: ImageValue): image is ImageValue & { mediaId: string } {
  return image.mediaId !== null;
}

/** Stable key for a pinned section version, matching the API's `typeId@version`. */
export function versionKey(ref: Pick<SectionInstance, "sectionTypeId" | "version">): string {
  return `${ref.sectionTypeId}@${ref.version}`;
}
