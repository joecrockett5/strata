// Re-exports of the generated content types plus a few convenience aliases.
export type * from "./generated";

import type {
  ChildNode,
  ImageSlotDefinition,
  LinkSlotDefinition,
  RichTextSlotDefinition,
  SectionDefinition,
  SectionNode,
  SiteDocument,
  TextSlotDefinition,
} from "./generated";

/**
 * Union of slot definitions. The schema's `SlotDefinition` union is not referenced by any node
 * (nodes reference the concrete slot types), so the generator does not emit it.
 */
export type SlotDefinition =
  TextSlotDefinition | RichTextSlotDefinition | ImageSlotDefinition | LinkSlotDefinition;

/** Any primitive, including the section root. */
export type Node = SectionNode | ChildNode;

export type PrimitiveType = Node["$type"];

/** A content document accepted by the API. */
export type ContentDocument = SectionDefinition | SiteDocument;
