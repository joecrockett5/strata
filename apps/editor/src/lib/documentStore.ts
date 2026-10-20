import { applyPatches, type Draft, enablePatches, type Patch, produceWithPatches } from "immer";
import { createStore, type StoreApi } from "zustand/vanilla";

enablePatches();

interface HistoryEntry {
  label: string;
  patches: Patch[];
  inverse: Patch[];
  /** Consecutive changes with the same group (e.g. typing in one slot) merge into one entry. */
  group: string | undefined;
  at: number;
}

export interface DocumentState<T> {
  doc: T;
  /** Server revision the current save chain is based on (the ETag). */
  revision: number;
  /** Increments on every change, undo and redo; autosave compares it with savedVersion. */
  version: number;
  savedVersion: number;
  past: HistoryEntry[];
  future: HistoryEntry[];
}

export interface DocumentActions<T> {
  /** Replaces the document (initial load or reload) and clears history. */
  load(doc: T, revision: number): void;
  change(label: string, recipe: (draft: Draft<T>) => void, options?: { group?: string }): void;
  undo(): void;
  redo(): void;
  /** Records a successful save of `version` that produced server revision `revision`. */
  markSaved(revision: number, version: number): void;
}

export type DocumentStore<T> = StoreApi<DocumentState<T> & DocumentActions<T>>;

const GROUP_WINDOW_MS = 1500;
const HISTORY_LIMIT = 200;

/**
 * A document with undo/redo built on Immer patches. Each change records forward and inverse
 * patches, so history costs proportional to the edit, not the document size.
 */
export function createDocumentStore<T>(initial: T, revision: number): DocumentStore<T> {
  return createStore<DocumentState<T> & DocumentActions<T>>()((set, get) => ({
    doc: initial,
    revision,
    version: 0,
    savedVersion: 0,
    past: [],
    future: [],

    load(doc, rev) {
      set({ doc, revision: rev, version: 0, savedVersion: 0, past: [], future: [] });
    },

    change(label, recipe, options) {
      const state = get();
      const [doc, patches, inverse] = produceWithPatches(state.doc, recipe);
      if (patches.length === 0) return;

      const now = Date.now();
      const last = state.past.at(-1);
      const group = options?.group;
      const merge =
        group !== undefined &&
        last?.group === group &&
        now - last.at < GROUP_WINDOW_MS &&
        state.future.length === 0;
      const entry: HistoryEntry = merge
        ? {
            label,
            patches: [...last.patches, ...patches],
            inverse: [...inverse, ...last.inverse],
            group,
            at: now,
          }
        : { label, patches, inverse, group, at: now };
      const past = merge ? [...state.past.slice(0, -1), entry] : [...state.past, entry].slice(-HISTORY_LIMIT);

      set({ doc, past, future: [], version: state.version + 1 });
    },

    undo() {
      const { past, future, doc, version } = get();
      const entry = past.at(-1);
      if (!entry) return;
      set({
        doc: applyPatches(doc as object, entry.inverse) as T,
        past: past.slice(0, -1),
        future: [entry, ...future],
        version: version + 1,
      });
    },

    redo() {
      const { past, future, doc, version } = get();
      const [entry, ...rest] = future;
      if (!entry) return;
      set({
        doc: applyPatches(doc as object, entry.patches) as T,
        past: [...past, { ...entry, group: undefined }],
        future: rest,
        version: version + 1,
      });
    },

    markSaved(rev, savedVersion) {
      set({ revision: rev, savedVersion: Math.max(get().savedVersion, savedVersion) });
    },
  }));
}
