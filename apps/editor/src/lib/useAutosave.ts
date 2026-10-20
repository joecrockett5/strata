import { ApiError, type ContentViolation } from "@strata/api-client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import type { DocumentStore } from "./documentStore";

export type SaveStatus =
  | { kind: "saved" }
  | { kind: "pending" }
  | { kind: "saving" }
  | { kind: "conflict" }
  | { kind: "invalid"; violations: ContentViolation[] }
  | { kind: "error"; message: string };

export interface SaveResult {
  revision: number;
}

/**
 * Debounced autosave with optimistic concurrency. Each save sends the revision it is based on
 * (If-Match); a 409 stops autosaving and asks the user to reload, a 422 shows the violations
 * until the next edit.
 */
export function useAutosave<T>(
  store: DocumentStore<T>,
  save: (doc: T, revision: number) => Promise<SaveResult>,
  delayMs = 800,
): { status: SaveStatus; flush: () => Promise<void> } {
  const version = useStore(store, (s) => s.version);
  const savedVersion = useStore(store, (s) => s.savedVersion);
  const [status, setStatus] = useState<SaveStatus>({ kind: "saved" });
  const saving = useRef(false);
  const blocked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saveRef = useRef(save);
  useLayoutEffect(() => {
    saveRef.current = save;
  });

  const run = useCallback(async () => {
    if (saving.current || blocked.current) return;
    const { doc, revision, version: target, savedVersion: saved } = store.getState();
    if (target === saved) {
      setStatus({ kind: "saved" });
      return;
    }
    saving.current = true;
    setStatus({ kind: "saving" });
    try {
      const result = await saveRef.current(doc, revision);
      store.getState().markSaved(result.revision, target);
      const latest = store.getState();
      setStatus(latest.version === latest.savedVersion ? { kind: "saved" } : { kind: "pending" });
    } catch (error) {
      if (error instanceof ApiError && error.isConflict) {
        blocked.current = true;
        setStatus({ kind: "conflict" });
      } else if (error instanceof ApiError && error.isValidation) {
        setStatus({ kind: "invalid", violations: error.problem.errors ?? [] });
      } else {
        setStatus({ kind: "error", message: error instanceof Error ? error.message : "Save failed" });
      }
    } finally {
      saving.current = false;
    }
  }, [store]);

  useEffect(() => {
    if (version === savedVersion || blocked.current) return;
    setStatus((current) => (current.kind === "saving" ? current : { kind: "pending" }));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void run(), delayMs);
    return () => {
      clearTimeout(timer.current);
    };
  }, [version, savedVersion, delayMs, run]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      const s = store.getState();
      if (s.version !== s.savedVersion) event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [store]);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    // Wait for an in-flight save, then save whatever is left.
    while (saving.current) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    await run();
  }, [run]);

  return { status, flush };
}
