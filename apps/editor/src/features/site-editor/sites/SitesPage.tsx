import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { type SiteSummary, useDeleteSite, useSites } from "../api";

export function SitesPage() {
  const sites = useSites();
  const [deleting, setDeleting] = useState<SiteSummary | null>(null);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center gap-4">
        <div className="mr-auto">
          <h1 className="text-2xl font-semibold">My sites</h1>
          <p className="text-sm text-slate-600">Edit drafts, then publish when you are ready.</p>
        </div>
        <Link
          to="/sites/new"
          className="inline-flex h-10 items-center gap-1.5 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700"
        >
          <Plus className="size-4" aria-hidden /> New site
        </Link>
      </div>
      {sites.isPending ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {sites.data?.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          You have no sites yet. Create one from a starter template.
        </p>
      ) : null}
      <ul className="grid gap-3 sm:grid-cols-2">
        {sites.data?.map((site) => (
          <li
            key={site.id}
            className="flex items-start gap-3 rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200"
            data-testid="site-card"
          >
            <div className="min-w-0 flex-1">
              <Link to={`/sites/${site.id}`} className="font-medium hover:underline">
                {site.name}
              </Link>
              <p className="truncate text-xs text-slate-500">/s/{site.slug}</p>
              <p className="mt-2 flex gap-1">
                {site.isPublished ? (
                  <Badge tone="green">Published</Badge>
                ) : (
                  <Badge tone="amber">Not published</Badge>
                )}
                {site.isPublished && site.hasUnpublishedChanges ? (
                  <Badge tone="blue">Unpublished changes</Badge>
                ) : null}
              </p>
            </div>
            <IconButton
              label={`Delete ${site.name}`}
              onClick={() => {
                setDeleting(site);
              }}
            >
              <Trash2 className="size-4" />
            </IconButton>
          </li>
        ))}
      </ul>
      {deleting ? (
        <DeleteSiteDialog
          site={deleting}
          onClose={() => {
            setDeleting(null);
          }}
        />
      ) : null}
    </main>
  );
}

function DeleteSiteDialog({ site, onClose }: { site: SiteSummary; onClose: () => void }) {
  const remove = useDeleteSite();
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Delete ${site.name}?`}
      description="The site, its drafts and published versions are removed. This cannot be undone."
    >
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="danger"
          disabled={remove.isPending}
          onClick={() => {
            void remove.mutateAsync(site.id).then(onClose);
          }}
        >
          Delete site
        </Button>
      </div>
    </Dialog>
  );
}
