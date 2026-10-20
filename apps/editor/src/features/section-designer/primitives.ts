// The palette of primitives and factories that create them with sensible, publishable defaults
// (unique node ids and slot keys, default alt text, etc.).
import {
  ownSlots,
  type ChildNode,
  type PrimitiveType,
  type SectionDefinition,
  walkDefinition,
} from "@strata/schema";

export interface PaletteEntry {
  type: Exclude<PrimitiveType, "section">;
  label: string;
  description: string;
  group: "Layout" | "Content" | "Site";
}

export const palette: readonly PaletteEntry[] = [
  { type: "stack", label: "Stack", description: "Vertical group with gap and alignment", group: "Layout" },
  {
    type: "columns",
    label: "Columns",
    description: "1–4 columns that stack on small screens",
    group: "Layout",
  },
  { type: "repeater", label: "Repeater", description: "A list of items owners can add to", group: "Layout" },
  { type: "spacer", label: "Spacer", description: "Vertical space from the spacing scale", group: "Layout" },
  { type: "divider", label: "Divider", description: "Horizontal rule", group: "Layout" },
  { type: "heading", label: "Heading", description: "h1–h4 text", group: "Content" },
  {
    type: "richText",
    label: "Rich text",
    description: "Paragraphs, bold, italic, links, lists",
    group: "Content",
  },
  { type: "image", label: "Image", description: "Image with alt text", group: "Content" },
  { type: "button", label: "Button", description: "Label and link", group: "Content" },
  { type: "nav", label: "Navigation", description: "Logo, firm name and page links", group: "Site" },
  { type: "contactForm", label: "Contact form", description: "Name, email, phone, message", group: "Site" },
];

/** Every node id and slot/repeater key already used in the definition. */
function usedNames(definition: SectionDefinition): { ids: Set<string>; keys: Set<string> } {
  const ids = new Set<string>();
  const keys = new Set<string>();
  for (const { node } of walkDefinition(definition)) {
    ids.add(node.id);
    if (node.$type === "repeater") keys.add(node.key);
    for (const slot of ownSlots(node)) keys.add(slot.key);
  }
  return { ids, keys };
}

function unique(base: string, used: Set<string>): string {
  for (let n = 1; ; n++) {
    const candidate = `${base}${n}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
}

/** Creates a primitive whose ids and keys do not clash with `definition`. */
export function createPrimitive(type: PaletteEntry["type"], definition: SectionDefinition): ChildNode {
  const { ids, keys } = usedNames(definition);
  const id = unique(`${type}-`, ids);
  const text = (base: string, label: string, value: string) =>
    ({
      key: unique(base, keys),
      label,
      type: "text",
      mode: "editable",
      required: false,
      default: { $type: "text", text: value },
    }) as const;

  switch (type) {
    case "stack":
      return { $type: "stack", id, gap: "md", align: "start", children: [] };
    case "columns":
      return {
        $type: "columns",
        id,
        ratio: "1:1",
        gap: "lg",
        valign: "start",
        stackAt: "tablet",
        columns: [{ children: [] }, { children: [] }],
      };
    case "repeater":
      return {
        $type: "repeater",
        id,
        key: unique("items", keys),
        itemLabel: "Item",
        min: 1,
        max: 6,
        defaultItemCount: 3,
        layout: "grid-3",
        gap: "lg",
        children: [],
      };
    case "spacer":
      return { $type: "spacer", id, size: "md" };
    case "divider":
      return { $type: "divider", id };
    case "heading":
      return {
        $type: "heading",
        id,
        level: 2,
        align: "start",
        text: { ...text("heading", "Heading", "Heading"), maxLength: 120 },
      };
    case "richText":
      return {
        $type: "richText",
        id,
        align: "start",
        content: {
          key: unique("text", keys),
          label: "Text",
          type: "richText",
          mode: "editable",
          required: false,
          default: { $type: "richText", html: "<p>Write a short paragraph here.</p>" },
        },
      };
    case "image":
      return {
        $type: "image",
        id,
        aspect: "4:3",
        fit: "cover",
        radius: "theme",
        image: {
          key: unique("image", keys),
          label: "Image",
          type: "image",
          mode: "editable",
          required: false,
          default: { $type: "image", mediaId: null, alt: "Describe the image" },
        },
      };
    case "button":
      return {
        $type: "button",
        id,
        variant: "primary",
        align: "start",
        label: { ...text("buttonLabel", "Button label", "Learn more"), maxLength: 40 },
        link: {
          key: unique("buttonLink", keys),
          label: "Button link",
          type: "link",
          mode: "editable",
          required: false,
          default: { $type: "link", target: null },
        },
      };
    case "nav":
      return { $type: "nav", id };
    case "contactForm":
      return {
        $type: "contactForm",
        id,
        submitLabel: {
          ...text("submitLabel", "Submit label", "Send message"),
          required: true,
          maxLength: 40,
        },
        successMessage: {
          ...text("successMessage", "Success message", "Thanks — we'll be in touch soon."),
          required: true,
        },
      };
  }
}

/** A copy of `node` (and its subtree) with fresh ids and keys. */
export function cloneWithFreshNames(node: ChildNode, definition: SectionDefinition): ChildNode {
  const { ids, keys } = usedNames(definition);
  const copy = structuredClone(node);
  const rename = (n: ChildNode) => {
    n.id = unique(`${n.$type}-`, ids);
    if (n.$type === "repeater") n.key = unique(n.key.replace(/\d+$/, ""), keys);
    for (const slot of ownSlots(n)) slot.key = unique(slot.key.replace(/\d+$/, ""), keys);
    const children =
      n.$type === "columns" ? n.columns.flatMap((c) => c.children) : "children" in n ? n.children : [];
    children.forEach(rename);
  };
  rename(copy);
  return copy;
}
