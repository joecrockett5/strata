import { ApiError, type ContentViolation } from "@strata/api-client";
import { type SectionDefinition, walkDefinition } from "@strata/schema";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Eye, Redo2, Rocket, Undo2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useStore } from "zustand";
import { ScaledFrame, CanvasFrame } from "@/components/canvas/CanvasFrame";
import { type Device, deviceWidths } from "@/components/canvas/devices";
import { DeviceToggle } from "@/components/canvas/DeviceToggle";
import { ConflictDialog, SaveIndicator } from "@/components/editor/SaveIndicator";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Select } from "@/components/ui/select";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createDocumentStore } from "@/lib/documentStore";
import { fallbackTheme, useThemePresets } from "@/lib/themes";
import { useAutosave } from "@/lib/useAutosave";
import { useUndoShortcuts } from "@/lib/useUndoShortcuts";
import {
  publishSectionTypeVersion,
  saveSectionTypeDraft,
  type SectionTypeDetail,
  sectionTypeKeys,
  useSectionType,
} from "../api";
import { StatusBadges } from "../library/SectionLibraryPage";
import { DesignerCanvas, SectionPreview } from "./DesignerCanvas";
import { PropertiesPanel } from "./PropertiesPanel";
import { createCommands, DesignerContext, type DesignerDocument, type Selection } from "./state";
import { StructurePanel } from "./StructurePanel";

export function SectionDesignerPage() {
  const { id = "" } = useParams();
  const query = useSectionType(id);
  if (query.isPending) return <p className="p-6 text-sm text-slate-500">Loading…</p>;
  if (query.isError) return <p className="p-6 text-sm text-red-700">{query.error.message}</p>;
  return <Designer key={id} detail={query.data} />;
}

type Meta = Pick<SectionTypeDetail, "latestVersion" | "hasUnpublishedChanges" | "archived" | "publishIssues">;

function Designer({ detail }: { detail: SectionTypeDetail }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [store] = useState(() =>
    createDocumentStore<DesignerDocument>(
      { name: detail.name, category: detail.category, definition: detail.draft },
      detail.revision,
    ),
  );
  const [selection, setSelection] = useState<Selection | null>(null);
  const [meta, setMeta] = useState<Meta>(detail);
  const [device, setDevice] = useState<Device>("desktop");
  const [presetId, setPresetId] = useState<string>();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [canvasDoc, setCanvasDoc] = useState<Document | null>(null);
  const [publishState, setPublishState] = useState<
    { kind: "idle" | "publishing" } | { kind: "done"; version: number } | { kind: "failed"; message: string }
  >({ kind: "idle" });

  const doc = useStore(store, (s) => s.doc);
  const canUndo = useStore(store, (s) => s.past.length > 0);
  const canRedo = useStore(store, (s) => s.future.length > 0);
  const presets = useThemePresets();
  const theme =
    presets.data?.find((p) => p.id === presetId)?.theme ?? presets.data?.[0]?.theme ?? fallbackTheme;

  const select = useCallback((next: Selection | null) => {
    setSelection(next);
  }, []);
  const commands = useMemo(() => createCommands(store, select), [store, select]);
  const context = useMemo(
    () => ({ store, commands, selection, select }),
    [store, commands, selection, select],
  );

  const save = useCallback(
    async (document: DesignerDocument, revision: number) => {
      const saved = await saveSectionTypeDraft(detail.id, revision, document);
      setMeta(saved);
      return { revision: saved.revision };
    },
    [detail.id],
  );
  const { status, flush } = useAutosave(store, save);

  const undo = useCallback(() => {
    store.getState().undo();
  }, [store]);
  const redo = useCallback(() => {
    store.getState().redo();
  }, [store]);
  const shortcutDocuments = useMemo(() => [document, canvasDoc], [canvasDoc]);
  useUndoShortcuts(undo, redo, shortcutDocuments);

  const publish = async () => {
    setPublishState({ kind: "publishing" });
    await flush();
    const state = store.getState();
    if (state.version !== state.savedVersion) {
      setPublishState({
        kind: "failed",
        message: "The latest changes could not be saved. Fix them before publishing.",
      });
      return;
    }
    try {
      const version = await publishSectionTypeVersion(detail.id, state.revision);
      setMeta((m) => ({ ...m, latestVersion: version.version, hasUnpublishedChanges: false }));
      setPublishState({ kind: "done", version: version.version });
      await queryClient.invalidateQueries({ queryKey: sectionTypeKeys.all });
    } catch (error) {
      if (error instanceof ApiError && error.isValidation) {
        setMeta((m) => ({ ...m, publishIssues: error.problem.errors ?? [] }));
        setPublishState({
          kind: "failed",
          message: error.problem.title ?? "The section cannot be published yet.",
        });
      } else {
        setPublishState({
          kind: "failed",
          message: error instanceof Error ? error.message : "Publishing failed.",
        });
      }
    }
  };

  const issues = status.kind === "invalid" ? status.violations : meta.publishIssues;
  const nothingToPublish = meta.latestVersion > 0 && !meta.hasUnpublishedChanges && status.kind === "saved";

  return (
    <DesignerContext.Provider value={context}>
      <TooltipProvider>
        <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
          <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
            <IconButton
              label="Back to section library"
              onClick={() => {
                void flush().then(() => navigate("/designer/sections"));
              }}
            >
              <ArrowLeft className="size-4" />
            </IconButton>
            <input
              aria-label="Section type name"
              className="w-56 rounded border border-transparent px-1.5 py-1 text-base font-semibold hover:border-slate-300 focus:border-blue-600 focus:outline-none"
              maxLength={120}
              value={doc.name}
              onChange={(e) => {
                store.getState().change(
                  "Rename",
                  (d) => {
                    d.name = e.target.value;
                  },
                  { group: "name" },
                );
              }}
            />
            <input
              aria-label="Category"
              className="w-32 rounded border border-transparent px-1.5 py-1 text-sm text-slate-600 hover:border-slate-300 focus:border-blue-600 focus:outline-none"
              maxLength={60}
              value={doc.category}
              onChange={(e) => {
                store.getState().change(
                  "Change category",
                  (d) => {
                    d.category = e.target.value;
                  },
                  { group: "category" },
                );
              }}
            />
            <StatusBadges type={meta} />
            <span className="text-xs text-slate-500" data-testid="latest-version">
              {meta.latestVersion > 0 ? `Latest: v${String(meta.latestVersion)}` : "Not published yet"}
            </span>
            <SaveIndicator status={status} />

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <IconButton label="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
                <Undo2 className="size-4" />
              </IconButton>
              <IconButton label="Redo (Shift+Ctrl+Z)" disabled={!canRedo} onClick={redo}>
                <Redo2 className="size-4" />
              </IconButton>
              <DeviceToggle value={device} onChange={setDevice} />
              <Select
                aria-label="Preview theme"
                className="h-8 w-36"
                value={presetId ?? presets.data?.[0]?.id ?? ""}
                options={(presets.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
                onValueChange={setPresetId}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setPreviewOpen(true);
                }}
              >
                <Eye className="size-4" aria-hidden /> Preview
              </Button>
              <Button
                size="sm"
                onClick={() => void publish()}
                disabled={
                  publishState.kind === "publishing" || meta.archived || issues.length > 0 || nothingToPublish
                }
                title={nothingToPublish ? "No changes since the latest version" : undefined}
              >
                <Rocket className="size-4" aria-hidden /> Publish version
              </Button>
            </div>
          </header>

          <PublishFeedback state={publishState} />
          {issues.length > 0 ? (
            <IssueList
              issues={issues}
              definition={doc.definition}
              onSelect={(nodeId) => {
                select({ nodeId });
              }}
            />
          ) : null}

          <div className="flex min-h-0 flex-1">
            <aside
              className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white"
              aria-label="Structure"
            >
              <StructurePanel />
            </aside>
            <main
              className="min-w-0 flex-1 overflow-auto bg-slate-100 p-6"
              aria-label="Canvas"
              data-testid="canvas-scroll"
            >
              <div className="mx-auto w-fit shadow-md ring-1 ring-slate-200">
                <DesignerCanvas
                  sectionTypeId={detail.id}
                  theme={theme}
                  width={deviceWidths[device]}
                  onDocument={setCanvasDoc}
                />
              </div>
            </main>
            <aside
              className="w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-white"
              aria-label="Properties"
            >
              <PropertiesPanel />
            </aside>
          </div>
        </div>

        <Dialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          title="Preview"
          description="Sample content at every device width, with the selected theme."
          className="w-[min(110rem,calc(100vw-2rem))]"
        >
          <div className="flex flex-wrap items-start gap-6" data-testid="preview-all">
            {(Object.entries(deviceWidths) as [Device, number][]).map(([name, width]) => (
              <ScaledFrame
                key={name}
                width={width}
                maxWidth={name === "desktop" ? 760 : name === "tablet" ? 420 : 300}
                label={deviceLabels[name]}
              >
                <CanvasFrame width={width} title={`Preview at ${String(width)}px`}>
                  <SectionPreview definition={doc.definition} theme={theme} sectionTypeId={detail.id} />
                </CanvasFrame>
              </ScaledFrame>
            ))}
          </div>
        </Dialog>
        <ConflictDialog open={status.kind === "conflict"} />
      </TooltipProvider>
    </DesignerContext.Provider>
  );
}

const deviceLabels: Record<Device, string> = { mobile: "Mobile", tablet: "Tablet", desktop: "Desktop" };

function PublishFeedback({ state }: { state: { kind: string; version?: number; message?: string } }) {
  if (state.kind === "done") {
    return (
      <p
        role="status"
        className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900"
        data-testid="publish-result"
      >
        Published version {state.version}. It is now available in the library.
      </p>
    );
  }
  if (state.kind === "failed") {
    return (
      <p
        role="alert"
        className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800"
        data-testid="publish-result"
      >
        {state.message}
      </p>
    );
  }
  return null;
}

/** Maps a JSON pointer from a violation to the deepest node it points into. */
function nodeForPath(definition: SectionDefinition, path: string): string | undefined {
  let best: { id: string; length: number } | undefined;
  for (const { node, path: nodePath } of walkDefinition(definition)) {
    if ((path === nodePath || path.startsWith(`${nodePath}/`)) && nodePath.length > (best?.length ?? -1)) {
      best = { id: node.id, length: nodePath.length };
    }
  }
  return best?.id;
}

function IssueList({
  issues,
  definition,
  onSelect,
}: {
  issues: ContentViolation[];
  definition: SectionDefinition;
  onSelect: (nodeId: string) => void;
}) {
  return (
    <section
      aria-label="Publish checks"
      className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950"
      data-testid="publish-issues"
    >
      <p className="flex items-center gap-1.5 font-medium">
        <AlertTriangle className="size-4" aria-hidden />
        {issues.length === 1
          ? "1 problem blocks publishing"
          : `${String(issues.length)} problems block publishing`}
      </p>
      <ul className="mt-1 space-y-0.5">
        {issues.map((issue) => {
          const nodeId = nodeForPath(definition, issue.path.replace(/^\/definition/, ""));
          return (
            <li key={`${issue.code}:${issue.path}`}>
              {nodeId ? (
                <button
                  type="button"
                  className="text-left underline decoration-amber-400 underline-offset-2 hover:decoration-amber-700"
                  onClick={() => {
                    onSelect(nodeId);
                  }}
                >
                  {issue.message}
                </button>
              ) : (
                issue.message
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
