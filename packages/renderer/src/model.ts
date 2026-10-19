// Rendering rules that are not components. Each mirrors a C# counterpart in Strata.Rendering so
// both renderers make the same decisions.
import type { LinkValue, RepeaterItem, RepeaterNode } from "@strata/schema";
import type { ContactField, RenderContext } from "./context";

/** Stable DOM id of a rendered section instance (anchors, publish-check navigation). */
export function sectionDomId(instanceId: string): string {
  return `section-${instanceId}`;
}

/** Resolves a link value to an href; undefined for empty or broken links. */
export function hrefOf(link: LinkValue, context: RenderContext): string | undefined {
  const target = link.target;
  if (!target) return undefined;
  return target.kind === "url" ? target.url : context.pageHrefs[target.pageId];
}

/** Items to render: the instance's items, or `defaultItemCount` empty items showing slot defaults. */
export function repeaterItems(node: RepeaterNode, items: RepeaterItem[] | undefined): RepeaterItem[] {
  return (
    items ?? Array.from({ length: node.defaultItemCount }, (_, i) => ({ id: `default-${i}`, values: {} }))
  );
}

export interface ContactFieldSpec {
  name: ContactField;
  label: string;
  type: "text" | "email" | "tel" | "textarea";
  required: boolean;
  maxLength: number;
  autoComplete?: string;
}

/** The fixed contact fields. Mirrors `ContactFields.All` in Strata.Rendering. */
export const contactFields: readonly ContactFieldSpec[] = [
  { name: "name", label: "Name", type: "text", required: true, maxLength: 100, autoComplete: "name" },
  { name: "email", label: "Email", type: "email", required: true, maxLength: 200, autoComplete: "email" },
  { name: "phone", label: "Phone", type: "tel", required: false, maxLength: 40, autoComplete: "tel" },
  { name: "message", label: "Message", type: "textarea", required: true, maxLength: 4000 },
];
