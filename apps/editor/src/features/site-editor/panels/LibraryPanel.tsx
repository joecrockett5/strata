import { useDraggable } from "@dnd-kit/core";
import type { Theme } from "@strata/schema";
import { versionKey } from "@strata/schema";
import { Plus } from "lucide-react";
import { useMemo } from "react";
import { useStore } from "zustand";
import { CanvasFrame, ScaledFrame } from "@/components/canvas/CanvasFrame";
import { SectionPreview } from "@/components/canvas/SectionPreview";
import { cn } from "@/lib/cn";
import { useLibrary } from "../api";
import type { CanvasDragSource } from "../canvas/SiteCanvas";
import { useSiteEditor } from "../editorState";
import { findPage, type PublishedSection } from "../siteModel";

/** Latest published sections by category. Click to append to the page, or drag between sections. */
export function LibraryPanel() {
  const { store, pageId, commands } = useSiteEditor();
  const theme = useStore(store, (s) => s.doc.site.theme);
  const library = useLibrary();

  const categories = useMemo(() => {
    const byCategory = new Map<string, PublishedSection[]>();
    for (const section of library.data ?? [])
      byCategory.set(section.category, [...(byCategory.get(section.category) ?? []), section]);
    return [...byCategory].sort(([a], [b]) => a.localeCompare(b));
  }, [library.data]);

  return (
    <div className="p-3">
      <h2 className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">Section library</h2>
      <p className="mb-3 text-xs text-slate-500">
        Click to add to the end of the page, or drag onto the canvas.
      </p>
      {library.isPending ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {library.data?.length === 0 ? (
        <p className="text-sm text-slate-500">No published sections yet.</p>
      ) : null}
      {categories.map(([category, sections]) => (
        <section key={category} className="mb-4" aria-label={category}>
          <h3 className="mb-1.5 text-xs font-medium text-slate-600">{category}</h3>
          <ul className="space-y-2">
            {sections.map((section) => (
              <LibraryCard
                key={versionKey(section)}
                section={section}
                theme={theme}
                onAdd={() => {
                  const page = findPage(store.getState().doc.site, pageId);
                  commands.addSection(section, pageId, page?.sections.length ?? 0);
                }}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function LibraryCard({
  section,
  theme,
  onAdd,
}: {
  section: PublishedSection;
  theme: Theme;
  onAdd: () => void;
}) {
  const key = versionKey(section);
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `library:${key}`,
    data: { source: { kind: "library", key, name: section.name } satisfies CanvasDragSource },
  });
  return (
    <li>
      <button
        ref={setNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        onClick={onAdd}
        aria-label={`Add ${section.name}`}
        data-testid={`library-card-${section.name}`}
        className={cn(
          "group block w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-left hover:border-blue-400 focus-visible:outline-2 focus-visible:outline-blue-600",
          isDragging && "opacity-50",
        )}
      >
        {/* A live, non-interactive preview (pointer events pass through so the card stays draggable). */}
        <div className="pointer-events-none max-h-28 overflow-hidden border-b border-slate-100" aria-hidden>
          <ScaledFrame width={1280} maxWidth={246} label="">
            <CanvasFrame width={1280} title={`${section.name} preview`} passThrough testId="preview-frame">
              <SectionPreview
                definition={section.definition}
                theme={theme}
                sectionTypeId={section.sectionTypeId}
              />
            </CanvasFrame>
          </ScaledFrame>
        </div>
        <span className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-700">
          <Plus className="size-3.5 text-slate-400 group-hover:text-blue-600" aria-hidden />
          {section.name}
          <span className="ml-auto text-slate-400">v{section.version}</span>
        </span>
      </button>
    </li>
  );
}
