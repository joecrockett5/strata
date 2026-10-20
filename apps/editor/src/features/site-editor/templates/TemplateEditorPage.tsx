import { ApiError } from "@strata/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Rocket } from "lucide-react";
import { useCallback, useState } from "react";
import { useParams } from "react-router";
import { useStore } from "zustand";
import { StatusBadges } from "@/components/editor/StatusBadges";
import { Button } from "@/components/ui/button";
import {
  publishTemplateVersion,
  saveTemplateDraft,
  type TemplateDetail,
  templateKeys,
  useTemplate,
} from "../api";
import { type EditorDocument, type EditorStore, useSiteEditor } from "../editorState";
import { SiteEditor } from "../SiteEditor";

export function TemplateEditorPage() {
  const { id = "" } = useParams();
  const query = useTemplate(id);
  if (query.isPending) return <p className="p-6 text-sm text-slate-500">Loading…</p>;
  if (query.isError) return <p className="p-6 text-sm text-red-700">{query.error.message}</p>;
  return <TemplateEditor key={id} detail={query.data} />;
}

type Meta = Pick<TemplateDetail, "latestVersion" | "hasUnpublishedChanges" | "archived">;

function TemplateEditor({ detail }: { detail: TemplateDetail }) {
  const queryClient = useQueryClient();
  const [meta, setMeta] = useState<Meta>(detail);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const save = useCallback(
    async (document: EditorDocument, revision: number) => {
      if (!document.template) throw new Error("Template metadata missing");
      const saved = await saveTemplateDraft(detail.id, revision, {
        ...document.template,
        document: document.site,
      });
      setMeta(saved);
      return { revision: saved.revision };
    },
    [detail.id],
  );

  const publish = async (flush: () => Promise<void>, store: EditorStore) => {
    setResult(null);
    await flush();
    const state = store.getState();
    if (state.version !== state.savedVersion) {
      setResult({ ok: false, message: "The latest changes could not be saved. Fix them before publishing." });
      return;
    }
    try {
      const version = await publishTemplateVersion(detail.id, state.revision);
      setMeta((m) => ({ ...m, latestVersion: version.version, hasUnpublishedChanges: false }));
      setResult({
        ok: true,
        message: `Published version ${String(version.version)}. New sites start from it.`,
      });
      await queryClient.invalidateQueries({ queryKey: templateKeys.all });
    } catch (error) {
      const message =
        error instanceof ApiError && error.isValidation
          ? (error.problem.errors ?? []).map((e) => e.message).join(" ") ||
            (error.problem.title ?? "Cannot publish yet.")
          : error instanceof Error
            ? error.message
            : "Publishing failed.";
      setResult({ ok: false, message });
    }
  };

  return (
    <SiteEditor
      author="designer"
      initial={{
        site: detail.document,
        template: {
          name: detail.name,
          description: detail.description,
          thumbnailMediaId: detail.thumbnailMediaId,
        },
      }}
      revision={detail.revision}
      sections={detail.sections}
      save={save}
      backTo="/designer/templates"
      title={<TemplateTitle />}
      actions={({ flush, store }) => (
        <>
          <StatusBadges type={meta} />
          <span className="text-xs text-slate-500" data-testid="latest-version">
            {meta.latestVersion > 0 ? `Latest: v${String(meta.latestVersion)}` : "Not published yet"}
          </span>
          {result ? (
            <span
              role={result.ok ? "status" : "alert"}
              className={result.ok ? "text-xs text-emerald-700" : "max-w-64 text-xs text-red-700"}
              data-testid="publish-result"
            >
              {result.message}
            </span>
          ) : null}
          <Button size="sm" disabled={meta.archived} onClick={() => void publish(flush, store)}>
            <Rocket className="size-4" aria-hidden /> Publish version
          </Button>
        </>
      )}
    />
  );
}

/** The template name is edited in the settings panel, so the title reads it from the document. */
function TemplateTitle() {
  const { store } = useSiteEditor();
  const name = useStore(store, (s) => s.doc.template?.name ?? "");
  return <h1 className="text-base font-semibold">{name || "Untitled template"}</h1>;
}
