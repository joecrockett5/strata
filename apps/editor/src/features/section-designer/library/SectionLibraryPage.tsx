import { Archive, ArchiveRestore, Copy, Plus } from "lucide-react";
import { type SyntheticEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import { StatusBadges } from "@/components/editor/StatusBadges";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { useCreateSectionType, useDuplicateSectionType, useSectionTypes, useSetArchived } from "../api";

export function SectionLibraryPage() {
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const types = useSectionTypes(showArchived);
  const duplicate = useDuplicateSectionType();
  const setArchived = useSetArchived();

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="mr-auto">
          <h1 className="text-2xl font-semibold">Section library</h1>
          <p className="text-sm text-slate-600">
            Section types that owners add to their pages. Publish a version to make it available.
          </p>
        </div>
        <Checkbox label="Show archived" checked={showArchived} onCheckedChange={setShowArchived} />
        <Button
          onClick={() => {
            setCreating(true);
          }}
        >
          <Plus className="size-4" aria-hidden /> New section type
        </Button>
      </div>

      {types.isPending ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {types.data?.length === 0 ? <p className="text-sm text-slate-500">No section types yet.</p> : null}
      {types.data && types.data.length > 0 ? (
        <table className="w-full border-collapse overflow-hidden rounded-lg bg-white text-sm shadow-sm ring-1 ring-slate-200">
          <thead className="bg-slate-50 text-left text-xs tracking-wide text-slate-500 uppercase">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">
                Name
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Category
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Version
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Status
              </th>
              <th scope="col" className="px-4 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {types.data.map((type) => (
              <tr key={type.id} className="border-t border-slate-100" data-testid="section-type-row">
                <td className="px-4 py-2.5 font-medium">
                  <Link to={`/designer/sections/${type.id}`} className="text-slate-900 hover:underline">
                    {type.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{type.category}</td>
                <td className="px-4 py-2.5 text-slate-600">
                  {type.latestVersion > 0 ? `v${String(type.latestVersion)}` : "—"}
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadges type={type} />
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    <IconButton
                      label={`Duplicate ${type.name}`}
                      onClick={() => {
                        duplicate.mutate(type.id);
                      }}
                    >
                      <Copy className="size-4" />
                    </IconButton>
                    <IconButton
                      label={`${type.archived ? "Restore" : "Archive"} ${type.name}`}
                      onClick={() => {
                        setArchived.mutate({ id: type.id, archived: !type.archived });
                      }}
                    >
                      {type.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                    </IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <CreateSectionTypeDialog
        open={creating}
        onOpenChange={setCreating}
        categories={[...new Set(types.data?.map((t) => t.category))]}
      />
    </main>
  );
}

function CreateSectionTypeDialog({
  open,
  onOpenChange,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: string[];
}) {
  const create = useCreateSectionType();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");

  const onSubmit = async (event: SyntheticEvent) => {
    event.preventDefault();
    const created = await create.mutateAsync({ name: name.trim(), category: category.trim() });
    onOpenChange(false);
    await navigate(`/designer/sections/${created.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="New section type">
      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
        <Field label="Name">
          {(props) => (
            <Input
              {...props}
              required
              maxLength={120}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
            />
          )}
        </Field>
        <Field label="Category" hint="Owners browse the library by category, e.g. Hero, Content, Contact.">
          {(props) => (
            <Input
              {...props}
              required
              maxLength={60}
              list="section-categories"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
              }}
            />
          )}
        </Field>
        <datalist id="section-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        {create.error ? (
          <p role="alert" className="text-sm text-red-700">
            {create.error.message}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            Create
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
