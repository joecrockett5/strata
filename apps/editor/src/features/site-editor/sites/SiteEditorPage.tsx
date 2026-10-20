import { useCallback, useState } from "react";
import { useParams } from "react-router";
import { Badge } from "@/components/ui/badge";
import { saveSiteDraft, type SiteDetail, useSite } from "../api";
import type { EditorDocument } from "../editorState";
import type { SiteIdentity } from "../panels/SettingsPanel";
import { SiteEditor } from "../SiteEditor";

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
      actions={() => (
        <span data-testid="publish-status">
          {!status.isPublished ? (
            <Badge tone="amber">Not published</Badge>
          ) : status.hasUnpublishedChanges ? (
            <Badge tone="blue">Unpublished changes</Badge>
          ) : (
            <Badge tone="green">Published</Badge>
          )}
        </span>
      )}
    />
  );
}
