import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Page } from "@strata/schema";
import { Copy, EyeOff, GripVertical, Home, Plus, Settings2, Trash2 } from "lucide-react";
import { type SyntheticEvent, useState } from "react";
import { useStore } from "zustand";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import { useSiteEditor } from "../editorState";
import { canDeletePage, pageSlugPattern } from "../siteModel";

/** Pages in navigation order. Drag (or keyboard: space, arrows) to reorder; the site nav follows. */
export function PagesPanel() {
  const { store, pageId, setPageId, commands, author } = useSiteEditor();
  const site = useStore(store, (s) => s.doc.site);
  const [settingsFor, setSettingsFor] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = site.pages.findIndex((p) => p.id === active.id);
    const to = site.pages.findIndex((p) => p.id === over.id);
    // Sortable reports the index the item should take; moveSection-style semantics count before removal.
    commands.movePage(String(active.id), from < to ? to + 1 : to);
  };

  const settingsPage = site.pages.find((p) => p.id === settingsFor);

  return (
    <div className="p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Pages</h2>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setAdding(true);
          }}
        >
          <Plus className="size-4" aria-hidden /> Add page
        </Button>
      </div>
      <p className="mb-2 text-xs text-slate-500">The order here is the navigation order.</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={site.pages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-1" aria-label="Pages">
            {site.pages.map((page) => (
              <PageRow
                key={page.id}
                page={page}
                current={page.id === pageId}
                canDelete={canDeletePage(site, page.id, author)}
                onOpen={() => {
                  setPageId(page.id);
                }}
                onSettings={() => {
                  setSettingsFor(page.id);
                }}
                onDuplicate={() => {
                  commands.duplicatePage(page.id);
                }}
                onDelete={() => {
                  commands.removePage(page.id, author);
                }}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {adding ? (
        <AddPageDialog
          onClose={() => {
            setAdding(false);
          }}
          onAdd={(title) => commands.addPage(title)}
        />
      ) : null}
      {settingsPage ? (
        <PageSettingsDialog
          key={settingsPage.id}
          page={settingsPage}
          otherSlugs={site.pages.filter((p) => p.id !== settingsPage.id).map((p) => p.slug)}
          onClose={() => {
            setSettingsFor(null);
          }}
          onApply={(patch) => {
            commands.change("Edit page settings", (d) => {
              const target = d.pages.find((p) => p.id === settingsPage.id);
              if (target) Object.assign(target, patch);
            });
          }}
        />
      ) : null}
    </div>
  );
}

function PageRow({
  page,
  current,
  canDelete,
  onOpen,
  onSettings,
  onDuplicate,
  onDelete,
}: {
  page: Page;
  current: boolean;
  canDelete: boolean;
  onOpen: () => void;
  onSettings: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({ id: page.id });
  const isHome = page.slug === "";
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group flex items-center gap-1 rounded-md border px-1 py-1 text-sm",
        current ? "border-blue-200 bg-blue-50" : "border-transparent hover:bg-slate-100",
        isDragging && "z-10 bg-white shadow-md",
      )}
      data-testid={`page-row-${page.slug === "" ? "home" : page.slug}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${page.title}`}
        className="inline-flex size-6 cursor-grab items-center justify-center rounded text-slate-400 hover:bg-slate-200"
      >
        <GripVertical className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onOpen}
        aria-current={current ? "page" : undefined}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
      >
        {isHome ? <Home className="size-3.5 shrink-0 text-slate-500" aria-label="Home page" /> : null}
        <span className={cn("truncate", current && "font-medium")}>{page.title}</span>
        {!page.showInNav ? (
          <EyeOff className="size-3.5 shrink-0 text-slate-400" aria-label="Not in navigation" />
        ) : null}
      </button>
      <div className="flex opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
        <IconButton label={`Settings for ${page.title}`} onClick={onSettings}>
          <Settings2 className="size-3.5" />
        </IconButton>
        <IconButton label={`Duplicate ${page.title}`} onClick={onDuplicate}>
          <Copy className="size-3.5" />
        </IconButton>
        <IconButton
          label={`Delete ${page.title}`}
          disabled={!canDelete}
          title={
            canDelete
              ? `Delete ${page.title}`
              : isHome
                ? "The home page cannot be deleted"
                : "Has sections the template requires"
          }
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" />
        </IconButton>
      </div>
    </li>
  );
}

function AddPageDialog({ onAdd, onClose }: { onAdd: (title: string) => void; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (title.trim() === "") return;
    onAdd(title.trim());
    onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Add page"
    >
      <form className="space-y-4" onSubmit={submit}>
        <Field label="Page title">
          {(props) => (
            <Input
              {...props}
              required
              maxLength={80}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
              }}
            />
          )}
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Add page</Button>
        </div>
      </form>
    </Dialog>
  );
}

type PagePatch = Pick<Page, "title" | "slug" | "showInNav" | "seo">;

function PageSettingsDialog({
  page,
  otherSlugs,
  onApply,
  onClose,
}: {
  page: Page;
  otherSlugs: string[];
  onApply: (patch: PagePatch) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<PagePatch>({
    title: page.title,
    slug: page.slug,
    showInNav: page.showInNav,
    seo: { ...page.seo },
  });
  const isHome = page.slug === "";
  const slugError = isHome
    ? undefined
    : !pageSlugPattern.test(form.slug)
      ? "Lower-case letters, digits and single hyphens."
      : otherSlugs.includes(form.slug)
        ? "Another page uses this address."
        : undefined;

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (slugError || form.title.trim() === "") return;
    onApply({ ...form, title: form.title.trim() });
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Page settings · ${page.title}`}
    >
      <form className="space-y-4" onSubmit={submit}>
        <Field label="Title" hint="Shown in the navigation.">
          {(props) => (
            <Input
              {...props}
              required
              maxLength={80}
              value={form.title}
              onChange={(e) => {
                setForm({ ...form, title: e.target.value });
              }}
            />
          )}
        </Field>
        <Field
          label="Address"
          hint={isHome ? "The home page lives at the site root." : `/${form.slug}`}
          error={slugError}
        >
          {(props) => (
            <Input
              {...props}
              disabled={isHome}
              maxLength={60}
              value={isHome ? "(home)" : form.slug}
              onChange={(e) => {
                setForm({ ...form, slug: e.target.value.toLowerCase() });
              }}
            />
          )}
        </Field>
        <Checkbox
          label="Show in navigation"
          checked={form.showInNav}
          onCheckedChange={(showInNav) => {
            setForm({ ...form, showInNav });
          }}
        />
        <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-xs font-semibold text-slate-700">Search engines</legend>
          <Field
            label="SEO title"
            hint="Shown in browser tabs and search results. Defaults to the page title."
          >
            {(props) => (
              <Input
                {...props}
                maxLength={120}
                value={form.seo.title}
                onChange={(e) => {
                  setForm({ ...form, seo: { ...form.seo, title: e.target.value } });
                }}
              />
            )}
          </Field>
          <Field label="SEO description" hint={`${String(form.seo.description.length)}/320 characters`}>
            {(props) => (
              <Textarea
                {...props}
                maxLength={320}
                value={form.seo.description}
                onChange={(e) => {
                  setForm({ ...form, seo: { ...form.seo, description: e.target.value } });
                }}
              />
            )}
          </Field>
        </fieldset>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={slugError !== undefined}>
            Apply
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
