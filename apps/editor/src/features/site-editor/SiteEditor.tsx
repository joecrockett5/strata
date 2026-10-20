import {
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  DragOverlay,
  type DragOverEvent,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { ContentViolation } from "@strata/api-client";
import { effectiveValue, type SectionDefinition, type SectionInstance, versionKey } from "@strata/schema";
import type { Editor } from "@tiptap/react";
import { AlertTriangle, ArrowLeft, Redo2, Undo2 } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useNavigate } from "react-router";
import { useStore } from "zustand";
import { type Device, deviceWidths } from "@/components/canvas/devices";
import { DeviceToggle } from "@/components/canvas/DeviceToggle";
import { ConflictDialog, SaveIndicator } from "@/components/editor/SaveIndicator";
import { RichTextToolbar } from "@/components/richtext/RichTextEditor";
import { IconButton } from "@/components/ui/icon-button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { createDocumentStore } from "@/lib/documentStore";
import { useAutosave } from "@/lib/useAutosave";
import { useUndoShortcuts } from "@/lib/useUndoShortcuts";
import { useLibrary } from "./api";
import { SectionRegistry } from "./sectionRegistry";
import type { CanvasDragSource, CanvasDropIndicator, CanvasDropRef } from "./canvas/SiteCanvas";
import { SiteCanvas } from "./canvas/SiteCanvas";
import type { ButtonRequest, CanvasCallbacks, ImageRequest } from "./canvas/useSiteAdapter";
import { ButtonDialog } from "./dialogs/ButtonDialog";
import { ImageDialog } from "./dialogs/ImageDialog";
import {
  createSiteCommands,
  definitionFor,
  type EditorDocument,
  type EditorStore,
  SiteEditorContext,
  useSiteEditor,
} from "./editorState";
import { LibraryPanel } from "./panels/LibraryPanel";
import { PagesPanel } from "./panels/PagesPanel";
import { SettingsPanel, type SiteIdentity } from "./panels/SettingsPanel";
import { ThemePanel } from "./panels/ThemePanel";
import {
  type Author,
  findInstance,
  findPage,
  homePage,
  type PublishedSection,
  randomId,
  sectionPermissions,
} from "./siteModel";

type Tab = "pages" | "sections" | "theme" | "settings";

const tabs: { id: Tab; label: string }[] = [
  { id: "pages", label: "Pages" },
  { id: "sections", label: "Add section" },
  { id: "theme", label: "Theme" },
  { id: "settings", label: "Settings" },
];

export interface EditorActionsApi {
  flush: () => Promise<void>;
  store: EditorStore;
  /** Shows a page and selects (and scrolls to) one of its sections, e.g. from a publish issue. */
  focus: (pageId: string | null, instanceId: string | null) => void;
}

export interface SiteEditorProps {
  author: Author;
  initial: EditorDocument;
  revision: number;
  sections: readonly PublishedSection[];
  save: (document: EditorDocument, revision: number) => Promise<{ revision: number }>;
  backTo: string;
  title: ReactNode;
  /** Badges and buttons for the header (publish, status); receives a flush to save first. */
  actions: (api: EditorActionsApi) => ReactNode;
  site?: SiteIdentity;
  onRenamed?: (identity: SiteIdentity) => void;
}

/** The drag-and-drop page editor shared by site owners (sites) and designers (starter templates). */
export function SiteEditor({
  author,
  initial,
  revision,
  sections: initialSections,
  save,
  backTo,
  title,
  actions,
  site: identity,
  onRenamed,
}: SiteEditorProps) {
  const navigate = useNavigate();
  const [store] = useState(() => createDocumentStore<EditorDocument>(initial, revision));
  const [registry] = useState(() => new SectionRegistry(initialSections));
  const sections = useSyncExternalStore(registry.subscribe, registry.snapshot);
  const [pageId, setPageId] = useState(() => homePage(initial.site).id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("pages");
  const [device, setDevice] = useState<Device>("desktop");
  const [frameDocument, setFrameDocument] = useState<Document | null>(null);
  const [richText, setRichText] = useState<Editor | null>(null);
  const [imageRequest, setImageRequest] = useState<ImageRequest | null>(null);
  const [buttonRequest, setButtonRequest] = useState<ButtonRequest | null>(null);
  const site = useStore(store, (s) => s.doc.site);
  const canUndo = useStore(store, (s) => s.past.length > 0);
  const canRedo = useStore(store, (s) => s.future.length > 0);
  const library = useLibrary();

  // Keep the visible page valid after undo/delete.
  const currentPageId = findPage(site, pageId) ? pageId : homePage(site).id;

  const commands = useMemo(
    () =>
      createSiteCommands(store, {
        newId: randomId,
        register: registry.register,
        definitionOf: (instanceId) =>
          definitionFor(store.getState().doc.site, registry.snapshot(), instanceId),
        select: setSelectedId,
        setPageId,
      }),
    [store, registry],
  );

  const context = useMemo(
    () => ({
      store,
      author,
      commands,
      sections,
      pageId: currentPageId,
      setPageId,
      selectedId,
      select: setSelectedId,
    }),
    [store, author, commands, sections, currentPageId, selectedId],
  );

  const { status, flush } = useAutosave(store, save);
  const undo = useCallback(() => {
    store.getState().undo();
  }, [store]);
  const redo = useCallback(() => {
    store.getState().redo();
  }, [store]);
  const shortcutDocuments = useMemo(() => [document, frameDocument], [frameDocument]);
  useUndoShortcuts(undo, redo, shortcutDocuments);

  const callbacks = useMemo<CanvasCallbacks>(
    () => ({
      hover: setHoveredId,
      openImage: setImageRequest,
      openButton: setButtonRequest,
      activateRichText: setRichText,
    }),
    [],
  );

  // ---- Drag and drop: library cards and section handles onto overlay boxes over the canvas.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [source, setSource] = useState<CanvasDragSource | null>(null);
  const [drop, setDrop] = useState<{ index: number; indicator: CanvasDropIndicator } | null>(null);
  const startY = useRef(0);

  // dnd-kit updates `over` after onDragMove, so drops are resolved on move, over and end alike.
  const resolveDrop = (event: DragMoveEvent | DragOverEvent | DragEndEvent) => {
    const ref = (event.over?.data.current as { ref?: CanvasDropRef } | undefined)?.ref;
    const page = findPage(store.getState().doc.site, currentPageId);
    if (!event.over || !ref || !source || !page) return null;
    if (ref.kind === "empty-page")
      return { index: 0, indicator: { instanceId: null, edge: "top" as const, allowed: true } };
    const index = page.sections.findIndex((s) => s.id === ref.instanceId);
    if (index < 0) return null;
    const fraction =
      (startY.current + event.delta.y - event.over.rect.top) / Math.max(1, event.over.rect.height);
    const edge = fraction < 0.5 ? ("top" as const) : ("bottom" as const);
    return {
      index: edge === "top" ? index : index + 1,
      indicator: { instanceId: ref.instanceId, edge, allowed: true },
    };
  };

  const onDragStart = (event: DragStartEvent) => {
    startY.current = (event.activatorEvent as PointerEvent).clientY;
    setSource((event.active.data.current as { source?: CanvasDragSource } | undefined)?.source ?? null);
  };
  const onDragMoveOrOver = (event: DragMoveEvent | DragOverEvent) => {
    setDrop(resolveDrop(event));
  };
  const onDragEnd = (event: DragEndEvent) => {
    const final = resolveDrop(event);
    if (final && source?.kind === "library") {
      const section = library.data?.find((s) => versionKey(s) === source.key);
      if (section) commands.addSection(section, currentPageId, final.index);
    } else if (final && source?.kind === "section") {
      commands.moveSection(source.instanceId, final.index);
    }
    setSource(null);
    setDrop(null);
  };

  const focus = useCallback((targetPage: string | null, instanceId: string | null) => {
    if (targetPage) setPageId(targetPage);
    setSelectedId(instanceId);
    if (!instanceId) return;
    // The page may need to render and be measured before its section box exists.
    let tries = 0;
    const scroll = () => {
      const box = document.querySelector(`[data-testid="section-box-${CSS.escape(instanceId)}"]`);
      if (box) box.scrollIntoView({ block: "center" });
      else if (++tries < 20) requestAnimationFrame(scroll);
    };
    requestAnimationFrame(scroll);
  }, []);

  const openBackgroundImage = (instance: SectionInstance, definition: SectionDefinition) => {
    const slot = definition.root.backgroundImage;
    if (slot)
      setImageRequest({
        target: { instanceId: instance.id, slotKey: slot.key },
        slot,
        value: effectiveValue(slot, instance.values),
      });
  };

  const violations: ContentViolation[] = status.kind === "invalid" ? status.violations : [];

  return (
    <SiteEditorContext.Provider value={context}>
      <TooltipProvider>
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={onDragStart}
          onDragMove={onDragMoveOrOver}
          onDragOver={onDragMoveOrOver}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            setSource(null);
            setDrop(null);
          }}
        >
          <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
            <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
              <IconButton
                label="Back"
                onClick={() => {
                  void flush().then(() => navigate(backTo));
                }}
              >
                <ArrowLeft className="size-4" />
              </IconButton>
              {title}
              <SaveIndicator status={status} />
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <IconButton label="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
                  <Undo2 className="size-4" />
                </IconButton>
                <IconButton label="Redo (Shift+Ctrl+Z)" disabled={!canRedo} onClick={redo}>
                  <Redo2 className="size-4" />
                </IconButton>
                <DeviceToggle value={device} onChange={setDevice} />
                {actions({ flush, store, focus })}
              </div>
            </header>

            {violations.length > 0 ? <ViolationList violations={violations} /> : null}
            {richText && !richText.isDestroyed ? <ActiveRichTextBar editor={richText} /> : null}

            <div className="flex min-h-0 flex-1">
              <aside
                className="flex w-80 shrink-0 flex-col border-r border-slate-200 bg-white"
                aria-label="Editor panels"
              >
                <div role="tablist" aria-label="Panels" className="flex border-b border-slate-200">
                  {tabs.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={tab === t.id}
                      aria-controls={`panel-${t.id}`}
                      id={`tab-${t.id}`}
                      onClick={() => {
                        setTab(t.id);
                      }}
                      className={cn(
                        "flex-1 border-b-2 px-2 py-2 text-xs font-medium",
                        tab === t.id
                          ? "border-slate-900 text-slate-900"
                          : "border-transparent text-slate-500 hover:text-slate-800",
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div
                  role="tabpanel"
                  id={`panel-${tab}`}
                  aria-labelledby={`tab-${tab}`}
                  className="min-h-0 flex-1 overflow-y-auto"
                >
                  {tab === "pages" ? <PagesPanel /> : null}
                  {tab === "sections" ? <LibraryPanel /> : null}
                  {tab === "theme" ? <ThemePanel /> : null}
                  {tab === "settings" ? (
                    <SettingsPanel
                      {...(identity ? { site: identity } : {})}
                      {...(onRenamed ? { onRenamed } : {})}
                    />
                  ) : null}
                </div>
              </aside>
              <main
                className="min-w-0 flex-1 overflow-auto bg-slate-100 p-6"
                aria-label="Canvas"
                data-testid="canvas-scroll"
              >
                <p className="mb-2 text-center text-xs text-slate-500" data-testid="current-page">
                  Editing:{" "}
                  <span className="font-medium text-slate-700">{findPage(site, currentPageId)?.title}</span>
                </p>
                <div className="mx-auto w-fit shadow-md ring-1 ring-slate-200">
                  <SiteCanvas
                    width={deviceWidths[device]}
                    dragging={source !== null}
                    dropIndicator={drop?.indicator ?? null}
                    callbacks={callbacks}
                    hoveredId={hoveredId}
                    onFrameDocument={setFrameDocument}
                    onBackgroundImage={openBackgroundImage}
                  />
                </div>
              </main>
            </div>
          </div>
          <DragOverlay dropAnimation={null}>
            {source ? (
              <div className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
                {source.name}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {imageRequest ? (
          <ImageDialog
            key={`${imageRequest.target.instanceId}:${imageRequest.target.itemId ?? ""}:${imageRequest.target.slotKey}`}
            title={imageRequest.slot.label}
            value={imageRequest.value}
            required={imageRequest.slot.required}
            onClose={() => {
              setImageRequest(null);
            }}
            onApply={(value) => {
              commands.setValue(imageRequest.target, value);
            }}
          />
        ) : null}
        {buttonRequest ? (
          <ButtonEditor
            request={buttonRequest}
            onClose={() => {
              setButtonRequest(null);
            }}
          />
        ) : null}
        <ConflictDialog open={status.kind === "conflict"} />
      </TooltipProvider>
    </SiteEditorContext.Provider>
  );
}

function ButtonEditor({ request, onClose }: { request: ButtonRequest; onClose: () => void }) {
  const { store, commands, author } = useSiteEditor();
  const site = store.getState().doc.site;
  const instance = findInstance(site, request.target.instanceId)?.instance;
  const labelEditable =
    request.labelSlot.mode === "editable" && (instance ? sectionPermissions(instance, author).edit : false);
  return (
    <ButtonDialog
      label={request.label}
      labelEditable={labelEditable}
      maxLength={request.labelSlot.maxLength}
      link={request.link}
      pages={site.pages}
      onClose={onClose}
      onApply={(label, link) => {
        commands.setValues("Edit button", [
          ...(labelEditable ? [[request.labelTarget, { $type: "text", text: label }] as const] : []),
          [request.target, link] as const,
        ]);
      }}
    />
  );
}

/** The rich-text toolbar lives in the editor chrome (Tailwind) and drives the TipTap editor inside the canvas. */
function ActiveRichTextBar({ editor }: { editor: Editor }) {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    editor.on("transaction", rerender);
    return () => {
      editor.off("transaction", rerender);
    };
  }, [editor]);
  return (
    <div className="border-b border-slate-200 bg-white px-4" aria-label="Text formatting">
      <RichTextToolbar editor={editor} />
    </div>
  );
}

function ViolationList({ violations }: { violations: ContentViolation[] }) {
  return (
    <section
      aria-label="Save problems"
      role="alert"
      className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900"
      data-testid="save-violations"
    >
      <p className="flex items-center gap-1.5 font-medium">
        <AlertTriangle className="size-4" aria-hidden /> Your latest changes were not saved
      </p>
      <ul className="mt-1 list-disc pl-6">
        {violations.map((v) => (
          <li key={`${v.code}:${v.path}`}>{v.message}</li>
        ))}
      </ul>
    </section>
  );
}
