# 0005 — Editor canvas: same-origin iframe, inline editors through an adapter, overlay for drag and drop

## Context

Owners edit "on a live-looking page". The canvas must use the real published stylesheet without
it leaking into the editor UI (or the editor's Tailwind reaching the site), must respond to
device widths through real media queries, and must support inline editing, selection and
drag-and-drop reordering. dnd-kit tracks the pointer in one document; an iframe is a second one.

## Decision

- **Iframe + portal.** The canvas is a same-origin `srcdoc` iframe containing `site.css` plus a
  small editor-only stylesheet (`canvasCss.ts`, every selector `stx-`/`data-stx-*`). React renders
  into its body with `createPortal`, so the canvas is part of the editor's React tree (shared
  state and events) while CSS stays isolated. The iframe is sized to its content (no inner
  scrolling); its width is the device preset (375/768/1280), so media queries respond to it.
- **Inline editing through the editing adapter** (ADR 0001): text slots become
  `contentEditable="plaintext-only"`, rich text becomes TipTap (its formatting bar lives in the
  editor chrome), images/buttons/repeater items get controls. Lock rules decide what is
  editable; locked content renders read-only with a lock icon and tooltip.
- **Overlay in the editor document.** Section outlines, toolbars and drag handles are absolutely
  positioned over the iframe at boxes measured inside it (Resize/MutationObserver). Because the
  iframe has no inner scroll, iframe coordinates equal overlay coordinates. All dnd-kit
  draggables (library cards, handles) and droppables (overlay boxes) live in the editor
  document; while a drag is active the iframe gets `pointer-events: none`, so pointer events
  never cross documents.
- **Section designer:** drag and drop targets the outline (layers) panel, which is also the
  keyboard-accessible fallback; the canvas there is for selection and preview.

## Consequences

- Site CSS must avoid `vh` units: an auto-height iframe would feed back into its own height.
- dnd-kit reports `over` after `onDragMove` for a position, so drops are resolved in
  `onDragOver` and from the final `onDragEnd` event (both editors).
- Keyboard users move sections with toolbar buttons and nodes with outline shortcuts; there is no
  keyboard drag sensor.
- Undo shortcuts are handled on both documents and use duck typing (elements in the iframe belong
  to another JavaScript realm, so `instanceof HTMLElement` is false for them).
