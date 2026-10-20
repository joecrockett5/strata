// Designer document, selection and the commands that change them. Palette clicks, drag and drop,
// outline buttons and keyboard shortcuts all call these, so every input method obeys the same
// placement rules (`canPlace`) and lands in undo history the same way.
import type { Node, SectionDefinition } from "@strata/schema";
import type { Draft } from "immer";
import { createContext, useContext } from "react";
import type { DocumentStore } from "@/lib/documentStore";
import { cloneWithFreshNames, createPrimitive, type PaletteEntry } from "../primitives";
import {
  canPlace,
  childList,
  findNode,
  hasType,
  indent,
  insertNode,
  isContainer,
  locate,
  type Location,
  moveBy,
  moveNode,
  outdent,
  removeNode,
} from "../tree";

export interface DesignerDocument {
  name: string;
  category: string;
  definition: SectionDefinition;
}

export type DesignerStore = DocumentStore<DesignerDocument>;

/** A selected node, or one column of a Columns node (a drop/insert target of its own). */
export interface Selection {
  nodeId: string;
  column?: number;
}

export interface DesignerContextValue {
  store: DesignerStore;
  commands: DesignerCommands;
  selection: Selection | null;
  select: (selection: Selection | null) => void;
}

export const DesignerContext = createContext<DesignerContextValue | null>(null);

export function useDesigner(): DesignerContextValue {
  const value = useContext(DesignerContext);
  if (!value) throw new Error("useDesigner must be used inside the section designer");
  return value;
}

/** Where a palette click inserts: inside the selected container, otherwise after the selected node. */
export function insertionPoint(definition: SectionDefinition, selection: Selection | null): Location {
  const rootEnd = { container: { parentId: definition.root.id }, index: definition.root.children.length };
  const node = selection ? findNode(definition, selection.nodeId) : undefined;
  if (!selection || !node) return rootEnd;
  if (node.$type === "columns") {
    const column = selection.column ?? 0;
    return { container: { parentId: node.id, column }, index: childList(node, column)?.length ?? 0 };
  }
  if (isContainer(node)) return { container: { parentId: node.id }, index: childList(node)?.length ?? 0 };
  const location = locate(definition, node.id);
  return location ? { container: location.container, index: location.index + 1 } : rootEnd;
}

export function canInsert(
  definition: SectionDefinition,
  type: PaletteEntry["type"],
  location: Location,
): boolean {
  return canPlace(definition, type, location.container);
}

export function createCommands(store: DesignerStore, select: (selection: Selection | null) => void) {
  const definition = () => store.getState().doc.definition;
  const change = (label: string, recipe: (d: Draft<SectionDefinition>) => boolean | undefined) => {
    let changed = false;
    store.getState().change(label, (doc) => {
      changed = recipe(doc.definition) ?? true;
    });
    return changed;
  };

  return {
    add(type: PaletteEntry["type"], location: Location) {
      const current = definition();
      if (!canInsert(current, type, location)) return false;
      const node = createPrimitive(type, current);
      const added = change(`Add ${type}`, (d) => insertNode(d, location, node));
      if (added) select({ nodeId: node.id });
      return added;
    },
    move(id: string, target: Location) {
      return change("Move", (d) => moveNode(d, id, target));
    },
    moveBy(id: string, delta: -1 | 1) {
      return change(delta < 0 ? "Move up" : "Move down", (d) => moveBy(d, id, delta));
    },
    indent(id: string) {
      return change("Move into previous", (d) => indent(d, id));
    },
    outdent(id: string) {
      return change("Move out", (d) => outdent(d, id));
    },
    duplicate(id: string) {
      const current = definition();
      const node = findNode(current, id);
      const location = locate(current, id);
      if (!node || node.$type === "section" || !location) return false;
      // Nav and contact form are one-per-section, so subtrees containing them cannot be copied.
      if (hasType(node, ["nav", "contactForm"]) || !canPlace(current, node.$type, location.container))
        return false;
      const copy = cloneWithFreshNames(node, current);
      const added = change("Duplicate", (d) =>
        insertNode(d, { container: location.container, index: location.index + 1 }, copy),
      );
      if (added) select({ nodeId: copy.id });
      return added;
    },
    remove(id: string) {
      const current = definition();
      const location = locate(current, id);
      if (!location) return false;
      const removed = change("Delete", (d) => removeNode(d, id) !== undefined);
      if (removed) {
        // Select a neighbour so keyboard users keep their place.
        const siblings = findNode(definition(), location.container.parentId);
        const list = siblings ? childList(siblings, location.container.column) : undefined;
        const next = list?.[Math.min(location.index, list.length - 1)];
        select(
          next
            ? { nodeId: next.id }
            : {
                nodeId: location.container.parentId,
                ...(location.container.column === undefined ? {} : { column: location.container.column }),
              },
        );
      }
      return removed;
    },
    /** Edits one node's properties; `group` coalesces keystrokes into one undo step. */
    update(id: string, label: string, recipe: (node: Draft<Node>) => void, group?: string) {
      store.getState().change(
        label,
        (doc) => {
          const node = findNode(doc.definition, id);
          if (node) recipe(node);
        },
        group === undefined ? undefined : { group: `${id}:${group}` },
      );
    },
  };
}

export type DesignerCommands = ReturnType<typeof createCommands>;
