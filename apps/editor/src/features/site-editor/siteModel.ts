// Pure operations on a site document (sites and starter templates), used inside Immer recipes,
// plus the permission checks that mirror the server's lock rules (Strata.Domain LockRules). The
// server stays authoritative; these only decide what the editor offers.
import type {
  Page,
  RepeaterItem,
  RepeaterNode,
  SectionDefinition,
  SectionInstance,
  SectionLock,
  SiteDocument,
  SlotDefinition,
  SlotValue,
  ThemeTokenPath,
} from "@strata/schema";
import { current, type Draft, isDraft } from "immer";

/** Who is editing: owners are bound by section/theme locks, designers (templates) set them. */
export type Author = "owner" | "designer";

export type Region = { kind: "header" } | { kind: "footer" } | { kind: "page"; pageId: string };

export interface LocatedInstance {
  instance: SectionInstance;
  region: Region;
}

/** A published section version the editor can render. */
export interface PublishedSection {
  sectionTypeId: string;
  version: number;
  name: string;
  category: string;
  definition: SectionDefinition;
}

export type NewId = () => string;

export const randomId: NewId = () => crypto.randomUUID();

/** A detached deep copy. Drafts are snapshotted first: Proxies cannot be structured-cloned. */
function detached<T>(value: T): T {
  return structuredClone(isDraft(value) ? current<T>(value as Draft<T>) : value);
}

// ---------------------------------------------------------------------------------------------
// Lookup

export function allInstances(doc: SiteDocument): LocatedInstance[] {
  const located: LocatedInstance[] = [];
  if (doc.header) located.push({ instance: doc.header, region: { kind: "header" } });
  for (const page of doc.pages) {
    for (const instance of page.sections)
      located.push({ instance, region: { kind: "page", pageId: page.id } });
  }
  if (doc.footer) located.push({ instance: doc.footer, region: { kind: "footer" } });
  return located;
}

export function findInstance(doc: SiteDocument, instanceId: string): LocatedInstance | undefined {
  return allInstances(doc).find((l) => l.instance.id === instanceId);
}

export function findPage(doc: SiteDocument, pageId: string): Page | undefined {
  return doc.pages.find((p) => p.id === pageId);
}

export function homePage(doc: SiteDocument): Page {
  return doc.pages.find((p) => p.slug === "") ?? doc.pages[0];
}

// ---------------------------------------------------------------------------------------------
// Permissions (mirror LockRules: rule 2 for sections, rule 3 for theme tokens)

export interface SectionPermissions {
  /** Editable slots may be changed, repeater items added/removed/reordered. */
  edit: boolean;
  /** Move up/down or drag within its page. */
  move: boolean;
  remove: boolean;
  hide: boolean;
  duplicate: boolean;
}

export function sectionPermissions(instance: SectionInstance, author: Author): SectionPermissions {
  if (author === "designer") return { edit: true, move: true, remove: true, hide: true, duplicate: true };
  switch (instance.lock) {
    case "locked":
      return { edit: false, move: false, remove: false, hide: false, duplicate: false };
    case "required":
      return { edit: true, move: true, remove: false, hide: false, duplicate: true };
    case "none":
      return { edit: true, move: true, remove: true, hide: true, duplicate: true };
  }
}

/** Rule 1: locked slots always show the designer's value, for every author. */
export function slotEditable(slot: SlotDefinition, instance: SectionInstance, author: Author): boolean {
  return slot.mode === "editable" && sectionPermissions(instance, author).edit;
}

/** Pages holding locked or required sections cannot be deleted by owners (those sections cannot be removed). */
export function canDeletePage(doc: SiteDocument, pageId: string, author: Author): boolean {
  const page = findPage(doc, pageId);
  if (!page || page.slug === "" || doc.pages.length <= 1) return false;
  return author === "designer" || page.sections.every((s) => s.lock === "none");
}

export function isTokenLocked(doc: SiteDocument, token: ThemeTokenPath, author: Author): boolean {
  return author === "owner" && doc.themeLocks.includes(token);
}

// ---------------------------------------------------------------------------------------------
// Sections

export function newInstance(section: PublishedSection, id: string): SectionInstance {
  return {
    id,
    sectionTypeId: section.sectionTypeId,
    version: section.version,
    lock: "none",
    hidden: false,
    values: {},
    repeaters: {},
  };
}

export function addSection(
  doc: SiteDocument,
  pageId: string,
  index: number,
  instance: SectionInstance,
): boolean {
  const page = findPage(doc, pageId);
  if (!page) return false;
  page.sections.splice(Math.max(0, Math.min(index, page.sections.length)), 0, instance);
  return true;
}

/** Moves a page section so it lands at `toIndex` as counted before removal (drop-indicator semantics). */
export function moveSection(doc: SiteDocument, instanceId: string, toIndex: number): boolean {
  const located = findInstance(doc, instanceId);
  if (located?.region.kind !== "page") return false;
  const page = findPage(doc, located.region.pageId);
  if (!page) return false;
  const from = page.sections.findIndex((s) => s.id === instanceId);
  const target = from < toIndex ? toIndex - 1 : toIndex;
  if (from < 0 || target === from || target < 0 || target >= page.sections.length) return false;
  const [moved] = page.sections.splice(from, 1);
  if (!moved) return false;
  page.sections.splice(target, 0, moved);
  return true;
}

export function moveSectionBy(doc: SiteDocument, instanceId: string, delta: -1 | 1): boolean {
  const located = findInstance(doc, instanceId);
  if (located?.region.kind !== "page") return false;
  const index = findPage(doc, located.region.pageId)?.sections.findIndex((s) => s.id === instanceId) ?? -1;
  return index >= 0 && moveSection(doc, instanceId, delta < 0 ? index - 1 : index + 2);
}

export function removeSection(doc: SiteDocument, instanceId: string): boolean {
  if (doc.header?.id === instanceId) {
    doc.header = null;
    return true;
  }
  if (doc.footer?.id === instanceId) {
    doc.footer = null;
    return true;
  }
  for (const page of doc.pages) {
    const index = page.sections.findIndex((s) => s.id === instanceId);
    if (index >= 0) {
      page.sections.splice(index, 1);
      return true;
    }
  }
  return false;
}

/** A copy with fresh ids. Copies never inherit lock flags (only templates set those). */
export function copyInstance(instance: SectionInstance, newId: NewId): SectionInstance {
  const copy = detached(instance);
  copy.id = newId();
  copy.lock = "none";
  for (const items of Object.values(copy.repeaters)) {
    for (const item of items ?? []) item.id = newId();
  }
  return copy;
}

export function duplicateSection(doc: SiteDocument, instanceId: string, newId: NewId): string | undefined {
  const located = findInstance(doc, instanceId);
  if (located?.region.kind !== "page") return undefined;
  const page = findPage(doc, located.region.pageId);
  const index = page?.sections.findIndex((s) => s.id === instanceId) ?? -1;
  if (!page || index < 0) return undefined;
  const copy = copyInstance(located.instance, newId);
  page.sections.splice(index + 1, 0, copy);
  return copy.id;
}

/** Applies `recipe` to an instance wherever it lives (header, footer or a page). */
export function updateInstance(
  doc: SiteDocument,
  instanceId: string,
  recipe: (instance: SectionInstance) => void,
): boolean {
  const located = findInstance(doc, instanceId);
  if (!located) return false;
  recipe(located.instance);
  return true;
}

export function setGlobalSection(
  doc: SiteDocument,
  region: "header" | "footer",
  instance: SectionInstance | null,
): void {
  doc[region] = instance;
}

export function setSectionLock(doc: SiteDocument, instanceId: string, lock: SectionLock): boolean {
  return updateInstance(doc, instanceId, (instance) => {
    instance.lock = lock;
    if (lock !== "none") instance.hidden = false;
  });
}

// ---------------------------------------------------------------------------------------------
// Slot values and repeater items

export interface SlotTarget {
  instanceId: string;
  slotKey: string;
  repeaterKey?: string;
  itemId?: string;
}

/** Placeholder ids the renderer gives default items (see `repeaterItems` in @strata/renderer). */
const defaultItemId = /^default-(\d+)$/;

/**
 * The instance's items for a repeater, creating real items when it still shows the designer's
 * default items. Editing one default item must not make the others disappear.
 */
export function materializeItems(
  instance: SectionInstance,
  repeater: RepeaterNode,
  newId: NewId,
): RepeaterItem[] {
  const existing = instance.repeaters[repeater.key];
  if (existing) return existing;
  const items = Array.from({ length: repeater.defaultItemCount }, () => ({ id: newId(), values: {} }));
  instance.repeaters[repeater.key] = items;
  return items;
}

function resolveItem(
  instance: SectionInstance,
  repeater: RepeaterNode,
  itemId: string,
  newId: NewId,
): RepeaterItem | undefined {
  const defaultIndex = defaultItemId.exec(itemId)?.[1];
  const wasDefault = instance.repeaters[repeater.key] === undefined;
  const items = materializeItems(instance, repeater, newId);
  return wasDefault && defaultIndex !== undefined
    ? items[Number(defaultIndex)]
    : items.find((i) => i.id === itemId);
}

export function repeaterNode(definition: SectionDefinition, key: string): RepeaterNode | undefined {
  const visit = (nodes: SectionDefinition["root"]["children"]): RepeaterNode | undefined => {
    for (const node of nodes) {
      if (node.$type === "repeater" && node.key === key) return node;
      const children =
        node.$type === "columns"
          ? node.columns.flatMap((c) => c.children)
          : "children" in node
            ? node.children
            : [];
      const found = visit(children);
      if (found) return found;
    }
    return undefined;
  };
  return visit(definition.root.children);
}

export function setSlotValue(
  doc: SiteDocument,
  definition: SectionDefinition,
  target: SlotTarget,
  value: SlotValue,
  newId: NewId,
): boolean {
  return updateInstance(doc, target.instanceId, (instance) => {
    if (target.repeaterKey === undefined || target.itemId === undefined) {
      instance.values[target.slotKey] = value;
      return;
    }
    const repeater = repeaterNode(definition, target.repeaterKey);
    const item = repeater ? resolveItem(instance, repeater, target.itemId, newId) : undefined;
    if (item) item.values[target.slotKey] = value;
  });
}

export function addRepeaterItem(
  doc: SiteDocument,
  definition: SectionDefinition,
  instanceId: string,
  repeaterKey: string,
  newId: NewId,
): string | undefined {
  let added: string | undefined;
  updateInstance(doc, instanceId, (instance) => {
    const repeater = repeaterNode(definition, repeaterKey);
    if (!repeater) return;
    const items = materializeItems(instance, repeater, newId);
    if (items.length >= repeater.max) return;
    added = newId();
    items.push({ id: added, values: {} });
  });
  return added;
}

export function removeRepeaterItem(
  doc: SiteDocument,
  definition: SectionDefinition,
  instanceId: string,
  repeaterKey: string,
  itemId: string,
  newId: NewId,
): boolean {
  let removed = false;
  updateInstance(doc, instanceId, (instance) => {
    const repeater = repeaterNode(definition, repeaterKey);
    if (!repeater) return;
    const item = resolveItem(instance, repeater, itemId, newId);
    const items = instance.repeaters[repeaterKey] ?? [];
    if (!item || items.length <= repeater.min) return;
    items.splice(items.indexOf(item), 1);
    removed = true;
  });
  return removed;
}

export function moveRepeaterItem(
  doc: SiteDocument,
  definition: SectionDefinition,
  instanceId: string,
  repeaterKey: string,
  itemId: string,
  delta: -1 | 1,
  newId: NewId,
): boolean {
  let moved = false;
  updateInstance(doc, instanceId, (instance) => {
    const repeater = repeaterNode(definition, repeaterKey);
    if (!repeater) return;
    const item = resolveItem(instance, repeater, itemId, newId);
    const items = instance.repeaters[repeaterKey] ?? [];
    const from = item ? items.indexOf(item) : -1;
    const to = from + delta;
    if (!item || from < 0 || to < 0 || to >= items.length) return;
    items.splice(from, 1);
    items.splice(to, 0, item);
    moved = true;
  });
  return moved;
}

// ---------------------------------------------------------------------------------------------
// Pages

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export function uniqueSlug(doc: SiteDocument, base: string, exceptPageId?: string): string {
  const taken = new Set(doc.pages.filter((p) => p.id !== exceptPageId).map((p) => p.slug));
  const root = base === "" ? "page" : base;
  if (!taken.has(root)) return root;
  for (let n = 2; ; n++) {
    const candidate = `${root}-${String(n)}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export const pageSlugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function addPage(doc: SiteDocument, title: string, newId: NewId): string {
  const id = newId();
  doc.pages.push({
    id,
    title,
    slug: uniqueSlug(doc, slugify(title)),
    showInNav: true,
    seo: { title, description: "" },
    sections: [],
  });
  return id;
}

/** A copy of a page after the original; section copies get fresh ids and no lock flags. */
export function duplicatePage(doc: SiteDocument, pageId: string, newId: NewId): string | undefined {
  const index = doc.pages.findIndex((p) => p.id === pageId);
  const page = doc.pages[index];
  if (!page) return undefined;
  const title = `${page.title} (copy)`.slice(0, 80);
  const copy: Page = {
    ...detached(page),
    id: newId(),
    title,
    slug: uniqueSlug(doc, slugify(page.slug === "" ? page.title : page.slug)),
    sections: page.sections.map((s) => copyInstance(s, newId)),
  };
  doc.pages.splice(index + 1, 0, copy);
  return copy.id;
}

export function removePage(doc: SiteDocument, pageId: string, author: Author): boolean {
  if (!canDeletePage(doc, pageId, author)) return false;
  doc.pages.splice(
    doc.pages.findIndex((p) => p.id === pageId),
    1,
  );
  return true;
}

/** Reorders pages (= navigation order); `toIndex` counts positions before removal. */
export function movePage(doc: SiteDocument, pageId: string, toIndex: number): boolean {
  const from = doc.pages.findIndex((p) => p.id === pageId);
  const target = from < toIndex ? toIndex - 1 : toIndex;
  if (from < 0 || target === from || target < 0 || target >= doc.pages.length) return false;
  const [page] = doc.pages.splice(from, 1);
  if (!page) return false;
  doc.pages.splice(target, 0, page);
  return true;
}
