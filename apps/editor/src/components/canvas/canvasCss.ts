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
`;
