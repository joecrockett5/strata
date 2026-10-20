// Site editor document, context and commands. Sites and starter templates share this editor; a
// template additionally carries its metadata and its author is a designer (who sets locks).
import type { SectionLock, SiteDocument, SlotValue, Theme, ThemeTokenPath } from "@strata/schema";
import { versionKey } from "@strata/schema";
import type { Draft } from "immer";
import { createContext, useContext } from "react";
import type { DocumentStore } from "@/lib/documentStore";
import {
  addPage,
  addRepeaterItem,
  addSection,
  type Author,
  duplicatePage,
  duplicateSection,
  findInstance,
  moveRepeaterItem,
  movePage,
  moveSection,
  moveSectionBy,
  type NewId,
  newInstance,
  type PublishedSection,
  removePage,
  removeRepeaterItem,
  removeSection,
  setSectionLock,
  setSlotValue,
  type SlotTarget,
  updateInstance,
} from "./siteModel";

export interface TemplateMeta {
  name: string;
  description: string;
  thumbnailMediaId: string | null;
}

export interface EditorDocument {
  site: SiteDocument;
  /** Present when editing a starter template. */
  template: TemplateMeta | null;
}

export type EditorStore = DocumentStore<EditorDocument>;

export interface SiteEditorContextValue {
  store: EditorStore;
  author: Author;
  commands: SiteCommands;
  /** Definitions by `typeId@version` for every instance the editor can render. */
  sections: ReadonlyMap<string, PublishedSection>;
  pageId: string;
  setPageId: (pageId: string) => void;
  selectedId: string | null;
  select: (instanceId: string | null) => void;
}

export const SiteEditorContext = createContext<SiteEditorContextValue | null>(null);

export function useSiteEditor(): SiteEditorContextValue {
  const value = useContext(SiteEditorContext);
  if (!value) throw new Error("useSiteEditor must be used inside the site editor");
  return value;
}

/** Token paths in the order the theme panel shows them. */
export const colorTokens = [
  "primary",
  "onPrimary",
  "secondary",
  "accent",
  "background",
  "surface",
  "text",
  "mutedText",
] as const satisfies readonly (keyof Theme["colors"])[];

export function createSiteCommands(
  store: EditorStore,
  options: {
    newId: NewId;
    /** Makes a definition available for rendering (sections inserted from the library). */
    register: (section: PublishedSection) => void;
    definitionOf: (instanceId: string) => PublishedSection | undefined;
    select: (instanceId: string | null) => void;
    setPageId: (pageId: string) => void;
  },
) {
  const { newId, register, definitionOf, select, setPageId } = options;
  const change = (label: string, recipe: (site: Draft<SiteDocument>) => void, group?: string) => {
    store.getState().change(
      label,
      (doc) => {
        recipe(doc.site);
      },
      group === undefined ? undefined : { group },
    );
  };
  const site = () => store.getState().doc.site;

  return {
    change,

    setValue(target: SlotTarget, value: SlotValue, group?: string) {
      const section = definitionOf(target.instanceId);
      if (!section) return;
      change(
        "Edit content",
        (d) => {
          setSlotValue(d, section.definition, target, value, newId);
        },
        group,
      );
    },

    /** Several slots of one instance in a single undo step (e.g. a button's label and link). */
    setValues(label: string, entries: readonly (readonly [SlotTarget, SlotValue])[]) {
      change(label, (d) => {
        for (const [target, value] of entries) {
          const section = definitionOf(target.instanceId);
          if (section) setSlotValue(d, section.definition, target, value, newId);
        }
      });
    },

    addSection(section: PublishedSection, pageId: string, index: number) {
      register(section);
      const instance = newInstance(section, newId());
      change(`Add ${section.name}`, (d) => {
        addSection(d, pageId, index, instance);
      });
      select(instance.id);
    },

    moveSection(instanceId: string, toIndex: number) {
      change("Move section", (d) => {
        moveSection(d, instanceId, toIndex);
      });
    },

    moveSectionBy(instanceId: string, delta: -1 | 1) {
      change(delta < 0 ? "Move section up" : "Move section down", (d) => {
        moveSectionBy(d, instanceId, delta);
      });
    },

    removeSection(instanceId: string) {
      change("Delete section", (d) => {
        removeSection(d, instanceId);
      });
      select(null);
    },

    duplicateSection(instanceId: string) {
      let copy: string | undefined;
      change("Duplicate section", (d) => {
        copy = duplicateSection(d, instanceId, newId);
      });
      if (copy) select(copy);
    },

    setHidden(instanceId: string, hidden: boolean) {
      change(hidden ? "Hide section" : "Show section", (d) => {
        updateInstance(d, instanceId, (i) => {
          i.hidden = hidden;
        });
      });
    },

    setLock(instanceId: string, lock: SectionLock) {
      change("Change section lock", (d) => {
        setSectionLock(d, instanceId, lock);
      });
    },

    setGlobal(region: "header" | "footer", section: PublishedSection | null) {
      if (section) register(section);
      change(section ? `Set ${region}` : `Remove ${region}`, (d) => {
        d[region] = section ? newInstance(section, newId()) : null;
      });
    },

    addItem(instanceId: string, repeaterKey: string) {
      const section = definitionOf(instanceId);
      if (!section) return;
      change("Add item", (d) => {
        addRepeaterItem(d, section.definition, instanceId, repeaterKey, newId);
      });
    },

    removeItem(instanceId: string, repeaterKey: string, itemId: string) {
      const section = definitionOf(instanceId);
      if (!section) return;
      change("Remove item", (d) => {
        removeRepeaterItem(d, section.definition, instanceId, repeaterKey, itemId, newId);
      });
    },

    moveItem(instanceId: string, repeaterKey: string, itemId: string, delta: -1 | 1) {
      const section = definitionOf(instanceId);
      if (!section) return;
      change("Move item", (d) => {
        moveRepeaterItem(d, section.definition, instanceId, repeaterKey, itemId, delta, newId);
      });
    },

    addPage(title: string) {
      let id = "";
      change("Add page", (d) => {
        id = addPage(d, title, newId);
      });
      setPageId(id);
      return id;
    },

    duplicatePage(pageId: string) {
      let id: string | undefined;
      change("Duplicate page", (d) => {
        id = duplicatePage(d, pageId, newId);
      });
      if (id) setPageId(id);
    },

    removePage(pageId: string, author: Author) {
      const fallback = site().pages.find((p) => p.slug === "")?.id;
      change("Delete page", (d) => {
        removePage(d, pageId, author);
      });
      if (fallback) setPageId(fallback);
    },

    movePage(pageId: string, toIndex: number) {
      change("Reorder pages", (d) => {
        movePage(d, pageId, toIndex);
      });
    },

    setThemeLock(token: ThemeTokenPath, locked: boolean) {
      change(locked ? "Lock theme token" : "Unlock theme token", (d) => {
        d.themeLocks = locked
          ? [...new Set([...d.themeLocks, token])]
          : d.themeLocks.filter((t) => t !== token);
      });
    },

    setTemplateMeta(label: string, recipe: (meta: Draft<TemplateMeta>) => void, group?: string) {
      store.getState().change(
        label,
        (doc) => {
          if (doc.template) recipe(doc.template);
        },
        group === undefined ? undefined : { group: `meta:${group}` },
      );
    },
  };
}

export type SiteCommands = ReturnType<typeof createSiteCommands>;

/** The definition an instance pins, if loaded. */
export function definitionFor(
  site: SiteDocument,
  sections: ReadonlyMap<string, PublishedSection>,
  instanceId: string,
): PublishedSection | undefined {
  const located = findInstance(site, instanceId);
  return located ? sections.get(versionKey(located.instance)) : undefined;
}
