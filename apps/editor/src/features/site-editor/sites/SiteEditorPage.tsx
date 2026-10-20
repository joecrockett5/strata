import { useCallback, useState } from "react";
import { ExternalLink, Inbox, Rocket } from "lucide-react";
import { Link, useParams } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { saveSiteDraft, type SiteDetail, useSite } from "../api";
import type { EditorDocument } from "../editorState";
import type { SiteIdentity } from "../panels/SettingsPanel";
import { type EditorActionsApi, SiteEditor } from "../SiteEditor";
import { PublishDialog } from "../dialogs/PublishDialog";

export function SiteEditorPage() {
  const { id = "" } = useParams();
  const query = useSite(id);
  if (query.isPending) return <p className="p-6 text-sm text-slate-500">Loading…</p>;
  if (query.isError) return <p className="p-6 text-sm text-red-700">{query.error.message}</p>;
  return <OwnerSiteEditor key={id} detail={query.data} />;
}

function OwnerSiteEditor({ detail }: { detail: SiteDetail }) {
  const [identity, setIdentity] = useState<SiteIdentity>({
    id: detail.id,
    name: detail.name,
    slug: detail.slug,
  });
  const [status, setStatus] = useState({
    isPublished: detail.isPublished,
    hasUnpublishedChanges: detail.hasUnpublishedChanges,
  });

  const [publishing, setPublishing] = useState<EditorActionsApi | null>(null);

  const save = useCallback(
    async (document: EditorDocument, revision: number) => {
      const saved = await saveSiteDraft(detail.id, revision, document.site);
      setStatus((s) => ({ ...s, hasUnpublishedChanges: saved.hasUnpublishedChanges }));
      return { revision: saved.revision };
    },
    [detail.id],
  );

  return (
    <SiteEditor
      author="owner"
      initial={{ site: detail.document, template: null }}
      revision={detail.revision}
      sections={detail.sections}
      save={save}
      backTo="/sites"
      site={identity}
      onRenamed={setIdentity}
      title={
        <>
          <h1 className="text-base font-semibold">{identity.name}</h1>
          <span className="text-xs text-slate-500">/s/{identity.slug}</span>
        </>
      }
      actions={(editor) => (
        <>
          <span data-testid="publish-status">
            {!status.isPublished ? (
              <Badge tone="amber">Not published</Badge>
            ) : status.hasUnpublishedChanges ? (
              <Badge tone="blue">Unpublished changes</Badge>
            ) : (
              <Badge tone="green">Published</Badge>
            )}
          </span>
          <Link
            to={`/sites/${detail.id}/submissions`}
            className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            <Inbox className="size-4" aria-hidden /> Messages
          </Link>
          {status.isPublished ? (
            <a
              href={`/s/${identity.slug}/`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              <ExternalLink className="size-4" aria-hidden /> View site
            </a>
          ) : null}
          <Button
            size="sm"
            onClick={() => {
              setPublishing(editor);
            }}
          >
            <Rocket className="size-4" aria-hidden /> Publish
          </Button>
          {publishing ? (
            <PublishDialog
              siteId={detail.id}
              editor={publishing}
              onClose={() => {
                setPublishing(null);
              }}
              onPublished={() => {
                setStatus({ isPublished: true, hasUnpublishedChanges: false });
              }}
            />
          ) : null}
        </>
      )}
    />
  );
}
