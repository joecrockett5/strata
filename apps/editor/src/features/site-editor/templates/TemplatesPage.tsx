import { Archive, ArchiveRestore, Plus } from "lucide-react";
import { type SyntheticEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import { StatusBadges } from "@/components/editor/StatusBadges";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useThemePresets } from "@/lib/themes";
import { useCreateTemplate, useSetTemplateArchived, useTemplates } from "../api";

export function TemplatesPage() {
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const templates = useTemplates(showArchived);
  const setArchived = useSetTemplateArchived();

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="mr-auto">
          <h1 className="text-2xl font-semibold">Starter templates</h1>
          <p className="text-sm text-slate-600">
            Whole-site blueprints owners start from. Publish a version to offer it.
          </p>
        </div>
        <Checkbox label="Show archived" checked={showArchived} onCheckedChange={setShowArchived} />
        <Button
          onClick={() => {
            setCreating(true);
          }}
        >
          <Plus className="size-4" aria-hidden /> New template
        </Button>
      </div>
      {templates.isPending ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {templates.data?.length === 0 ? <p className="text-sm text-slate-500">No templates yet.</p> : null}
      <ul className="space-y-2">
        {templates.data?.map((t) => (
          <li
            key={t.id}
            className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200"
            data-testid="template-row"
          >
            <div className="min-w-0 flex-1">
              <Link to={`/designer/templates/${t.id}`} className="font-medium hover:underline">
                {t.name}
              </Link>
              <p className="truncate text-xs text-slate-500">{t.description || "No description"}</p>
            </div>
            <span className="text-xs text-slate-500">
              {t.latestVersion > 0 ? `v${String(t.latestVersion)}` : "—"}
            </span>
            <StatusBadges type={t} />
            <IconButton
              label={`${t.archived ? "Restore" : "Archive"} ${t.name}`}
              onClick={() => {
                setArchived.mutate({ id: t.id, archived: !t.archived });
              }}
            >
              {t.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
            </IconButton>
          </li>
        ))}
      </ul>
      {creating ? (
        <CreateTemplateDialog
          onClose={() => {
            setCreating(false);
          }}
        />
      ) : null}
    </main>
  );
}

function CreateTemplateDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateTemplate();
  const presets = useThemePresets();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [presetId, setPresetId] = useState("");

  const submit = async (event: SyntheticEvent) => {
    event.preventDefault();
    const created = await create.mutateAsync({
      name: name.trim(),
      description: description.trim() || null,
      themePresetId: presetId || null,
    });
    onClose();
    await navigate(`/designer/templates/${created.id}`);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="New starter template"
    >
      <form className="space-y-4" onSubmit={(e) => void submit(e)}>
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
        <Field label="Description">
          {(props) => (
            <Textarea
              {...props}
              maxLength={500}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
              }}
            />
          )}
        </Field>
        <Field label="Theme">
          {(props) => (
            <Select
              {...props}
              value={presetId}
              options={[
                { value: "", label: "Strata default" },
                ...(presets.data ?? []).map((p) => ({ value: p.id, label: p.name })),
              ]}
              onValueChange={setPresetId}
            />
          )}
        </Field>
        {create.error ? (
          <p role="alert" className="text-sm text-red-700">
            {create.error.message}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
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
