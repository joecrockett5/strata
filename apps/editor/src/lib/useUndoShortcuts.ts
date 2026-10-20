import { useEffect } from "react";

// Duck-typed rather than `instanceof`: elements inside the canvas iframe belong to another realm.
function asElement(target: EventTarget | null): HTMLElement | undefined {
  return target !== null && typeof (target as Partial<HTMLElement>).tagName === "string"
    ? (target as HTMLElement)
    : undefined;
}

/** Fields with their own native undo, unless they opt into document history with data-stx-history. */
function hasNativeUndo(target: EventTarget | null): boolean {
  const element = asElement(target);
  if (!element || element.dataset.stxHistory === "document") return false;
  return element.isContentEditable || element.tagName === "INPUT" || element.tagName === "TEXTAREA";
}

/**
 * Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z (or Ctrl+Y). Listens on the given documents, so shortcuts also
 * work while focus is inside the canvas iframe. Native undo inside text fields is left alone.
 */
export function useUndoShortcuts(
  undo: () => void,
  redo: () => void,
  documents: (Document | null | undefined)[] = [document],
) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      if (hasNativeUndo(event.target)) return;
      event.preventDefault();
      if (key === "y" || event.shiftKey) redo();
      else undo();
    };
    const targets = documents.filter((d): d is Document => Boolean(d));
    for (const d of targets) d.addEventListener("keydown", onKeyDown);
    return () => {
      for (const d of targets) d.removeEventListener("keydown", onKeyDown);
    };
  }, [undo, redo, documents]);
}
