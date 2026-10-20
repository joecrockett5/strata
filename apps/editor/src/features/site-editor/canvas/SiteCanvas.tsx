import { useDraggable, useDroppable } from "@dnd-kit/core";
import { EditingAdapterContext, PageView } from "@strata/renderer";
import type { SectionDefinition, SectionInstance, SectionLock, SiteDocument } from "@strata/schema";
import { versionKey } from "@strata/schema";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, GripVertical, ImageIcon, Lock, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useStore } from "zustand";
import { CanvasFrame } from "@/components/canvas/CanvasFrame";
import { cn } from "@/lib/cn";
import { useSiteEditor } from "../editorState";
import { pageLinkPrefix, renderContextFor } from "./renderContext";
import { allInstances, findPage, type LocatedInstance, sectionPermissions, slotEditable } from "../siteModel";
import { type CanvasCallbacks, useSiteAdapter } from "./useSiteAdapter";

// ---------------------------------------------------------------------------------------------
// Drag and drop data shared with the editor's DndContext

export type CanvasDragSource =
  { kind: "library"; key: string; name: string } | { kind: "section"; instanceId: string; name: string };

export type CanvasDropRef = { kind: "section"; instanceId: string } | { kind: "empty-page" };

export interface CanvasDropIndicator {
  instanceId: string | null;
  edge: "top" | "bottom";
  allowed: boolean;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Section boxes measured inside the iframe. The iframe grows to its content (no inner scroll),
 * so iframe coordinates are overlay coordinates.
 */
function useSectionBoxes(frameDocument: Document | null): {
  sections: Record<string, Box>;
  main: Box | null;
} {
  const [layout, setLayout] = useState<{ sections: Record<string, Box>; main: Box | null }>({
    sections: {},
    main: null,
  });

  useEffect(() => {
    const view = frameDocument?.defaultView;
    const root = frameDocument?.getElementById("stx-root");
    if (!frameDocument || !view || !root) return;
    const box = (element: Element | null): Box | null => {
      if (!element) return null;
      const r = element.getBoundingClientRect();
      return { top: r.top, left: r.left, width: r.width, height: r.height };
    };
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const sections: Record<string, Box> = {};
        for (const wrapper of frameDocument.querySelectorAll<HTMLElement>("[data-stx-section]")) {
          const measured = box(wrapper.firstElementChild);
          if (measured && wrapper.dataset.stxSection) sections[wrapper.dataset.stxSection] = measured;
        }
        setLayout({ sections, main: box(frameDocument.querySelector(".st-main")) });
      });
    };
    const resize = new view.ResizeObserver(measure);
    resize.observe(root);
    const mutations = new view.MutationObserver(measure);
    mutations.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "src", "data-hidden"],
    });
    // Images change size when they load without mutating the DOM.
    frameDocument.addEventListener("load", measure, true);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
      frameDocument.removeEventListener("load", measure, true);
    };
  }, [frameDocument]);

  return layout;
}

// ---------------------------------------------------------------------------------------------

export function SiteCanvas({
  width,
  dragging,
  dropIndicator,
  callbacks,
  hoveredId,
  onFrameDocument,
  onBackgroundImage,
}: {
  width: number;
  dragging: boolean;
  dropIndicator: CanvasDropIndicator | null;
  callbacks: CanvasCallbacks;
  hoveredId: string | null;
  onFrameDocument: (doc: Document | null) => void;
  onBackgroundImage: (instance: SectionInstance, definition: SectionDefinition) => void;
}) {
  const { store, sections, pageId, setPageId, select } = useSiteEditor();
  const site = useStore(store, (s) => s.doc.site);
  const [frameDocument, setFrameDocument] = useState<Document | null>(null);
  const adapter = useSiteAdapter(site, callbacks);
  const context = useMemo(() => renderContextFor(site, pageId), [site, pageId]);
  const definitions = useMemo(
    () => Object.fromEntries([...sections].map(([key, s]) => [key, s.definition])),
    [sections],
  );
  const layout = useSectionBoxes(frameDocument);

  return (
    <div
      className="relative"
      onMouseLeave={() => {
        callbacks.hover(null);
      }}
    >
      <CanvasFrame
        width={width}
        title="Page canvas"
        editing
        passThrough={dragging}
        onDocument={(doc) => {
          setFrameDocument(doc);
          onFrameDocument(doc);
        }}
      >
        <EditingAdapterContext.Provider value={adapter}>
          <div
            onClickCapture={(event) => {
              const anchor = (event.target as Element).closest("a");
              const submit = (event.target as Element).closest("button[type=submit]");
              if (!anchor && !submit) return;
              event.preventDefault();
              const href = anchor?.getAttribute("href") ?? "";
              // Nav links switch the page being edited unless the click is editing the link text.
              if (href.startsWith(pageLinkPrefix) && !(event.target as HTMLElement).isContentEditable) {
                const page = site.pages.find((p) => p.slug === href.slice(pageLinkPrefix.length));
                if (page) setPageId(page.id);
              }
            }}
            onSubmitCapture={(event) => {
              event.preventDefault();
            }}
          >
            <PageView
              document={site}
              pageId={pageId}
              definitions={definitions}
              context={context}
              includeHidden
            />
          </div>
        </EditingAdapterContext.Provider>
      </CanvasFrame>

      <div className="pointer-events-none absolute inset-0" data-testid="canvas-overlay">
        {allInstances(site)
          .filter((located) => layout.sections[located.instance.id])
          .map((located) => {
            const box = layout.sections[located.instance.id];
            if (!box) return null;
            return (
              <SectionBox
                key={located.instance.id}
                located={located}
                box={box}
                site={site}
                pageId={pageId}
                name={sections.get(versionKey(located.instance))?.name ?? "Section"}
                definition={sections.get(versionKey(located.instance))?.definition}
                hovered={hoveredId === located.instance.id}
                indicator={dropIndicator?.instanceId === located.instance.id ? dropIndicator : null}
                dragging={dragging}
                onSelect={() => {
                  select(located.instance.id);
                }}
                onBackgroundImage={onBackgroundImage}
              />
            );
          })}
        {layout.main && findPage(site, pageId)?.sections.length === 0 ? (
          <EmptyPageDrop box={layout.main} indicator={dropIndicator} />
        ) : null}
      </div>
    </div>
  );
}

function EmptyPageDrop({ box, indicator }: { box: Box; indicator: CanvasDropIndicator | null }) {
  const { setNodeRef } = useDroppable({
    id: "drop:empty-page",
    data: { ref: { kind: "empty-page" } satisfies CanvasDropRef },
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "absolute rounded-lg",
        indicator && indicator.instanceId === null && "bg-blue-500/10 ring-2 ring-blue-500",
      )}
      style={{ ...box, minHeight: 80 }}
    />
  );
}

const lockLabels: Record<SectionLock, string> = {
  none: "Not locked",
  required: "Required",
  locked: "Locked",
};

function SectionBox({
  located,
  box,
  site,
  pageId,
  name,
  definition,
  hovered,
  indicator,
  dragging,
  onSelect,
  onBackgroundImage,
}: {
  located: LocatedInstance;
  box: Box;
  site: SiteDocument;
  pageId: string;
  name: string;
  definition: SectionDefinition | undefined;
  hovered: boolean;
  indicator: CanvasDropIndicator | null;
  dragging: boolean;
  onSelect: () => void;
  onBackgroundImage: (instance: SectionInstance, definition: SectionDefinition) => void;
}) {
  const { author, commands, selectedId } = useSiteEditor();
  const { instance, region } = located;
  const onPage = region.kind === "page" && region.pageId === pageId;
  const permissions = sectionPermissions(instance, author);
  const page = findPage(site, pageId);
  const index = onPage ? (page?.sections.findIndex((s) => s.id === instance.id) ?? -1) : -1;
  const count = page?.sections.length ?? 0;
  const selected = selectedId === instance.id;
  const background = definition?.root.backgroundImage;

  const {
    setNodeRef: setDragRef,
    setActivatorNodeRef,
    listeners,
    isDragging,
  } = useDraggable({
    id: `drag:${instance.id}`,
    disabled: !onPage || !permissions.move,
    data: { source: { kind: "section", instanceId: instance.id, name } satisfies CanvasDragSource },
  });
  const { setNodeRef: setDropRef } = useDroppable({
    id: `drop:${instance.id}`,
    disabled: !onPage,
    data: { ref: { kind: "section", instanceId: instance.id } satisfies CanvasDropRef },
  });

  const regionLabel =
    region.kind === "header" ? "Header · all pages" : region.kind === "footer" ? "Footer · all pages" : null;
  const lockReason =
    instance.lock === "locked"
      ? "Locked by the template"
      : instance.lock === "required"
        ? "Required by the template"
        : undefined;
  const showToolbar = (hovered || selected) && !dragging;

  return (
    <div
      ref={(element) => {
        setDragRef(element);
        setDropRef(element);
      }}
      className={cn(
        "absolute",
        (hovered || selected) && "outline-offset-[-2px]",
        hovered && !selected && "outline-1 outline-blue-500 outline-dashed",
        selected && "outline-2 outline-blue-600 outline-solid",
        isDragging && "opacity-40",
      )}
      style={box}
      data-testid={`section-box-${instance.id}`}
      data-section-name={name}
    >
      {indicator ? (
        <div
          aria-hidden
          className={cn(
            "absolute right-0 left-0 h-1 rounded",
            indicator.edge === "top" ? "-top-0.5" : "-bottom-0.5",
            indicator.allowed ? "bg-blue-600" : "bg-red-500",
          )}
        />
      ) : null}
      <div
        role="toolbar"
        aria-label={`${name} section`}
        className={cn(
          "pointer-events-auto absolute top-2 left-2 z-10 flex items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1 py-0.5 text-xs text-slate-700 shadow-md",
          !showToolbar && "sr-only focus-within:not-sr-only",
        )}
        onMouseDown={onSelect}
      >
        {onPage && permissions.move ? (
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...listeners}
            className="inline-flex size-7 cursor-grab items-center justify-center rounded text-slate-500 hover:bg-slate-100 active:cursor-grabbing"
            aria-label={`Drag ${name} to reorder`}
            title="Drag to reorder"
          >
            <GripVertical className="size-4" />
          </button>
        ) : null}
        <span className="px-1 font-medium">{regionLabel ?? name}</span>
        {lockReason ? (
          <span
            className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[0.7rem] text-slate-600"
            title={lockReason}
          >
            <Lock className="size-3" aria-hidden /> {instance.lock === "locked" ? "Locked" : "Required"}
          </span>
        ) : null}
        {instance.hidden ? (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[0.7rem] text-amber-900">Hidden</span>
        ) : null}
        <span className="mx-0.5 h-4 w-px bg-slate-200" />
        {onPage ? (
          <>
            <ToolButton
              label="Move section up"
              disabled={!permissions.move || index <= 0}
              reason={lockReason}
              onClick={() => {
                commands.moveSectionBy(instance.id, -1);
              }}
            >
              <ArrowUp className="size-4" />
            </ToolButton>
            <ToolButton
              label="Move section down"
              disabled={!permissions.move || index < 0 || index >= count - 1}
              reason={lockReason}
              onClick={() => {
                commands.moveSectionBy(instance.id, 1);
              }}
            >
              <ArrowDown className="size-4" />
            </ToolButton>
            <ToolButton
              label="Duplicate section"
              disabled={!permissions.duplicate}
              reason={lockReason}
              onClick={() => {
                commands.duplicateSection(instance.id);
              }}
            >
              <Copy className="size-4" />
            </ToolButton>
            <ToolButton
              label={instance.hidden ? "Show section" : "Hide section"}
              disabled={!permissions.hide || instance.lock !== "none"}
              reason={lockReason}
              onClick={() => {
                commands.setHidden(instance.id, !instance.hidden);
              }}
            >
              {instance.hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            </ToolButton>
          </>
        ) : null}
        {background ? (
          <ToolButton
            label="Background image"
            disabled={!slotEditable(background, instance, author)}
            reason={background.mode === "locked" ? "Locked by the template" : lockReason}
            onClick={() => {
              onBackgroundImage(instance, definition);
            }}
          >
            <ImageIcon className="size-4" />
          </ToolButton>
        ) : null}
        <ToolButton
          label="Delete section"
          disabled={!permissions.remove}
          reason={lockReason}
          onClick={() => {
            commands.removeSection(instance.id);
          }}
        >
          <Trash2 className="size-4" />
        </ToolButton>
        {author === "designer" ? (
          <select
            aria-label="Section lock"
            className="ml-1 h-7 rounded border border-slate-300 bg-white px-1 text-xs"
            value={instance.lock}
            onChange={(e) => {
              commands.setLock(instance.id, e.target.value as SectionLock);
            }}
          >
            {(Object.keys(lockLabels) as SectionLock[]).map((lock) => (
              <option key={lock} value={lock}>
                {lockLabels[lock]}
              </option>
            ))}
          </select>
        ) : null}
      </div>
    </div>
  );
}

function ToolButton({
  label,
  disabled,
  reason,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  reason: string | undefined;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={disabled && reason ? `${label}: not allowed (${reason.toLowerCase()})` : label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-7 items-center justify-center rounded hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
