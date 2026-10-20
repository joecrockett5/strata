/**
 * Editor-only styles injected into the canvas iframe next to the published site.css. Every
 * selector is prefixed `stx-`/`data-stx-` so it never collides with site styles (and site styles
 * never reach the editor chrome, which lives outside the iframe).
 */
export const canvasCss = `
html, body { margin: 0; }
body { background: #fff; }

/* Nodes are wrapped in display:contents elements so layout is untouched; outlines go on the child. */
[data-stx-node] { display: contents; }
[data-stx-node][data-stx-hovered] > * { outline: 1px dashed #3b82f6; outline-offset: 2px; cursor: pointer; }
[data-stx-node][data-stx-selected] > * { outline: 2px solid #2563eb; outline-offset: 2px; }

/* While editing, empty containers get a visible hint so they can be found and selected. */
#stx-root[data-editing] :is(.st-stack, .st-columns__col, .st-repeater__item, .st-section__inner):empty {
  min-height: 3rem;
  outline: 1px dashed #94a3b8;
  outline-offset: -1px;
  background: repeating-linear-gradient(45deg, transparent 0 8px, rgb(148 163 184 / 0.12) 8px 16px);
}

.stx-placeholder { opacity: 0.45; font-style: italic; }
.stx-image-placeholder {
  display: flex; align-items: center; justify-content: center; min-height: 8rem; width: 100%;
  border: 2px dashed #94a3b8; border-radius: var(--st-radius); color: #64748b;
  font: 500 0.875rem/1.2 system-ui, sans-serif; background: rgb(148 163 184 / 0.1); text-align: center; padding: 1rem;
}
.stx-locked { position: relative; }
.stx-lock-badge {
  display: inline-flex; align-items: center; gap: 0.2rem; margin-inline-start: 0.4rem; padding: 0.05rem 0.4rem;
  border-radius: 999px; background: #0f172a; color: #fff; font: 600 0.65rem/1.4 system-ui, sans-serif;
  vertical-align: middle; letter-spacing: 0.02em;
}
[data-stx-editable] { cursor: text; border-radius: 2px; }
[data-stx-editable]:hover { box-shadow: 0 0 0 1px rgb(59 130 246 / 0.6); }
[data-stx-editable]:focus { outline: 2px solid #2563eb; outline-offset: 2px; }
[data-stx-editable][data-stx-empty]::before { content: attr(data-stx-placeholder); opacity: 0.45; font-style: italic; }
.stx-hidden-section { opacity: 0.4; }

/* Site editor ------------------------------------------------------------------------------ */
[data-stx-section] { display: contents; }
[data-stx-section][data-hidden] > section { opacity: 0.4; }
#stx-root[data-editing] .st-main:empty {
  display: flex; align-items: center; justify-content: center; min-height: 10rem; margin: 1rem;
  border: 2px dashed #94a3b8; border-radius: 0.5rem; color: #64748b; font: 500 0.9rem/1.4 system-ui, sans-serif;
}
#stx-root[data-editing] .st-main:empty::before { content: "Drag a section here, or click one in the library."; }
[data-stx-editable][data-stx-over] { outline: 2px solid #dc2626; outline-offset: 2px; }
.stx-lock-icon { display: inline-block; width: 0.7em; height: 0.7em; margin-inline-start: 0.3em; vertical-align: baseline; opacity: 0.55; }
.stx-locked { cursor: not-allowed; }
.stx-image-edit { position: relative; display: block; cursor: pointer; border-radius: var(--st-radius); }
.stx-image-edit:hover, .stx-image-edit:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
.stx-image-edit .stx-image-hint {
  position: absolute; inset-inline-end: 0.5rem; inset-block-start: 0.5rem; padding: 0.15rem 0.5rem; border-radius: 999px;
  background: #0f172a; color: #fff; font: 600 0.7rem/1.4 system-ui, sans-serif; opacity: 0; transition: opacity 120ms;
}
.stx-image-edit:hover .stx-image-hint, .stx-image-edit:focus-visible .stx-image-hint { opacity: 1; }
.stx-chip {
  display: inline-flex; align-items: center; gap: 0.25rem; margin-inline-start: 0.5rem; padding: 0.2rem 0.55rem;
  border: 1px solid #cbd5e1; border-radius: 999px; background: #fff; color: #0f172a; cursor: pointer;
  font: 500 0.72rem/1.3 system-ui, sans-serif; vertical-align: middle;
}
.stx-chip:hover, .stx-chip:focus-visible { border-color: #2563eb; color: #1d4ed8; }
#stx-root[data-editing] .st-repeater__item { position: relative; }
.stx-item-toolbar {
  position: absolute; inset-block-start: -0.75rem; inset-inline-end: 0.25rem; z-index: 2; display: none; gap: 0.125rem;
  padding: 0.125rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; background: #fff; box-shadow: 0 1px 3px rgb(0 0 0 / 0.15);
}
.st-repeater__item:hover > .stx-item-toolbar, .st-repeater__item:focus-within > .stx-item-toolbar { display: inline-flex; }
.stx-item-toolbar button, .stx-add-item {
  display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 0.25rem; background: transparent;
  color: #334155; cursor: pointer; font: 500 0.75rem/1 system-ui, sans-serif;
}
.stx-item-toolbar button { width: 1.5rem; height: 1.5rem; }
.stx-item-toolbar button:hover:not(:disabled) { background: #e2e8f0; color: #0f172a; }
.stx-item-toolbar button:disabled { opacity: 0.35; cursor: not-allowed; }
.stx-add-item {
  gap: 0.35rem; min-height: 2.5rem; padding: 0.5rem 0.9rem; border: 2px dashed #94a3b8; border-radius: 0.5rem; color: #475569;
}
.stx-add-item:hover { border-color: #2563eb; color: #1d4ed8; }
.stx-prose:focus { outline: none; }
.stx-richtext-edit { border-radius: 2px; cursor: text; }
.stx-richtext-edit:hover { box-shadow: 0 0 0 1px rgb(59 130 246 / 0.6); }
.stx-richtext-edit:focus-within { outline: 2px solid #2563eb; outline-offset: 2px; }
`;
