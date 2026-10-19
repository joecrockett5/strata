import type {
  ButtonNode,
  ImageSlotDefinition,
  ImageValue,
  LinkValue,
  Node,
  RepeaterItem,
  RepeaterNode,
  RichTextSlotDefinition,
  RichTextValue,
  SectionInstance,
  TextSlotDefinition,
  TextValue,
} from "@strata/schema";
import { createContext, type ReactElement, type ReactNode, useContext } from "react";

/** Identifies a slot inside a section instance (and repeater item, if any). */
export interface SlotTarget {
  instanceId: string;
  slotKey: string;
  repeaterKey?: string;
  itemId?: string;
}

/**
 * Optional hooks the editor plugs into the renderer for selection outlines, inline editors and
 * repeater controls. With no adapter the renderer emits exactly the published markup.
 */
export interface EditingAdapter {
  /** Wraps or annotates every rendered node (e.g. selection in the section designer). */
  decorateNode?(args: { node: Node; path: string; element: ReactElement }): ReactNode;
  /** Wraps a whole section instance (e.g. data attributes for the canvas overlay). */
  decorateSection?(args: { instance: SectionInstance; element: ReactElement }): ReactNode;
  /** Content of a text slot (heading text, button label, …): return an inline editor. */
  text?(args: { slot: TextSlotDefinition; value: TextValue; target: SlotTarget }): ReactNode;
  /** Content of a rich-text slot. */
  richText?(args: { slot: RichTextSlotDefinition; value: RichTextValue; target: SlotTarget }): ReactNode;
  /** An image slot; `element` is the published markup (null when no image is set). */
  image?(args: {
    slot: ImageSlotDefinition;
    value: ImageValue;
    target: SlotTarget;
    element: ReactElement | null;
  }): ReactNode;
  /** A button; `element` is the published markup. */
  button?(args: { node: ButtonNode; link: LinkValue; target: SlotTarget; element: ReactElement }): ReactNode;
  /** One repeater item; `element` is the published markup for that item. */
  repeaterItem?(args: {
    node: RepeaterNode;
    item: RepeaterItem;
    index: number;
    count: number;
    instanceId: string;
    element: ReactElement;
  }): ReactNode;
  /** Rendered after a repeater's items (e.g. an "Add item" control). */
  afterRepeater?(args: { node: RepeaterNode; count: number; instanceId: string }): ReactNode;
}

export const EditingAdapterContext = createContext<EditingAdapter | undefined>(undefined);

export function useEditingAdapter(): EditingAdapter | undefined {
  return useContext(EditingAdapterContext);
}
