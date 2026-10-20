import type { SlotDefinition } from "@strata/schema";
import type { Draft } from "immer";
import { ImageIcon, Lock, LockOpen, X } from "lucide-react";
import { useState } from "react";
import { MediaLibraryDialog } from "@/components/media/MediaLibraryDialog";
import { RichTextEditor } from "@/components/richtext/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { mediaUrl } from "@/lib/media";
import { slotKeyPattern, urlPattern } from "./options";

export type SlotUpdate = (
  label: string,
  recipe: (slot: Draft<SlotDefinition>) => void,
  group?: string,
) => void;

const typeNames: Record<SlotDefinition["type"], string> = {
  text: "Text",
  richText: "Rich text",
  image: "Image",
  link: "Link",
};

/** Configures one slot: identity, whether owners may edit it, constraints, and the default content. */
export function SlotEditor({
  slot,
  update,
  otherKeys,
}: {
  slot: SlotDefinition;
  update: SlotUpdate;
  otherKeys: ReadonlySet<string>;
}) {
  const [key, setKey] = useState(slot.key);
  const [prevKey, setPrevKey] = useState(slot.key);
  // Follow undo/redo and selection changes while keeping an invalid draft key visible while typing.
  if (slot.key !== prevKey) {
    setPrevKey(slot.key);
    setKey(slot.key);
  }
  const keyError = !slotKeyPattern.test(key)
    ? "Start with a lower-case letter; letters and digits only (max 40)."
    : otherKeys.has(key)
      ? "Another slot or repeater already uses this key."
      : undefined;

  return (
    <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3" data-testid={`slot-${slot.key}`}>
      <legend className="px-1 text-xs font-semibold text-slate-700">
        {typeNames[slot.type]} slot
        {slot.mode === "locked" ? (
          <Lock className="ml-1 inline size-3 text-slate-500" aria-label="locked" />
        ) : null}
      </legend>

      <Field label="Label shown to owners">
        {(props) => (
          <Input
            {...props}
            maxLength={80}
            value={slot.label}
            onChange={(e) => {
              update("Rename slot", (s) => (s.label = e.target.value), "label");
            }}
          />
        )}
      </Field>

      <Field label="Key" hint="Stable identifier for stored values." error={keyError}>
        {(props) => (
          <Input
            {...props}
            className="font-mono"
            value={key}
            onChange={(e) => {
              const next = e.target.value;
              setKey(next);
              // Only valid, unique keys reach the document (the schema would reject the rest).
              if (slotKeyPattern.test(next) && !otherKeys.has(next))
                update("Change slot key", (s) => (s.key = next), "key");
            }}
          />
        )}
      </Field>

      <div className="space-y-1">
        <span className="block text-xs font-medium text-slate-700">Site owners</span>
        <Segmented
          label="Slot mode"
          value={slot.mode}
          onValueChange={(mode) => {
            update(mode === "locked" ? "Lock slot" : "Unlock slot", (s) => (s.mode = mode));
          }}
          options={[
            {
              value: "editable",
              label: "Can edit",
              icon: (
                <span className="inline-flex items-center gap-1">
                  <LockOpen className="size-3.5" /> Can edit
                </span>
              ),
            },
            {
              value: "locked",
              label: "Locked",
              icon: (
                <span className="inline-flex items-center gap-1">
                  <Lock className="size-3.5" /> Locked
                </span>
              ),
            },
          ]}
        />
        {slot.mode === "locked" ? (
          <p className="text-xs text-slate-500">Owners always see the default below and cannot change it.</p>
        ) : null}
      </div>

      <Checkbox
        label="Required"
        description={
          slot.type === "image"
            ? "Owners must choose an image (and alt text) before publishing."
            : "Must not be empty when publishing."
        }
        checked={slot.required}
        onCheckedChange={(required) => {
          update(required ? "Make slot required" : "Make slot optional", (s) => (s.required = required));
        }}
      />

      {slot.type === "text" || slot.type === "richText" ? (
        <Field
          label="Max length"
          hint={
            slot.type === "richText"
              ? "Visible characters, tags excluded. Empty for no limit."
              : "Empty for no limit."
          }
        >
          {(props) => (
            <Input
              {...props}
              type="number"
              min={1}
              max={5000}
              value={slot.maxLength ?? ""}
              onChange={(e) => {
                const value = e.target.valueAsNumber;
                update(
                  "Change max length",
                  (s) => {
                    if (s.type !== "text" && s.type !== "richText") return;
                    if (Number.isNaN(value)) delete s.maxLength;
                    else if (Number.isInteger(value) && value >= 1 && value <= 5000) s.maxLength = value;
                  },
                  "maxLength",
                );
              }}
            />
          )}
        </Field>
      ) : null}

      <DefaultValueEditor slot={slot} update={update} />
    </fieldset>
  );
}

function DefaultValueEditor({ slot, update }: { slot: SlotDefinition; update: SlotUpdate }) {
  const [mediaOpen, setMediaOpen] = useState(false);
  const label = slot.mode === "locked" ? "Content (locked)" : "Default content";

  switch (slot.type) {
    case "text": {
      const length = slot.default.text.length;
      const over = slot.maxLength !== undefined && length > slot.maxLength;
      return (
        <Field
          label={label}
          error={
            over ? `Longer than the max length (${String(length)}/${String(slot.maxLength)}).` : undefined
          }
        >
          {(props) => (
            <Input
              {...props}
              value={slot.default.text}
              onChange={(e) => {
                update(
                  "Edit default text",
                  (s) => {
                    if (s.type === "text") s.default.text = e.target.value;
                  },
                  "default",
                );
              }}
            />
          )}
        </Field>
      );
    }
    case "richText":
      return (
        <div className="space-y-1">
          <span className="block text-xs font-medium text-slate-700">{label}</span>
          <RichTextEditor
            label={label}
            value={slot.default.html}
            onChange={(html) => {
              update(
                "Edit default text",
                (s) => {
                  if (s.type === "richText") s.default.html = html;
                },
                "default",
              );
            }}
          />
        </div>
      );
    case "image": {
      const { mediaId, alt } = slot.default;
      return (
        <div className="space-y-2">
          <span className="block text-xs font-medium text-slate-700">{label}</span>
          <div className="flex items-center gap-2">
            {mediaId ? (
              <img
                src={mediaUrl(mediaId)}
                alt=""
                className="size-14 rounded border border-slate-200 object-cover"
              />
            ) : (
              <span className="flex size-14 items-center justify-center rounded border border-dashed border-slate-300 text-slate-400">
                <ImageIcon className="size-5" aria-hidden />
              </span>
            )}
            <div className="flex flex-col gap-1">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setMediaOpen(true);
                }}
              >
                {mediaId ? "Replace image" : "Choose image"}
              </Button>
              {mediaId ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    update("Remove default image", (s) => {
                      if (s.type === "image") s.default.mediaId = null;
                    });
                  }}
                >
                  <X className="size-3.5" aria-hidden /> Remove
                </Button>
              ) : null}
            </div>
          </div>
          <Field
            label="Alt text"
            hint={
              slot.required
                ? "Owners provide their own alt text per image."
                : "Required unless the slot is required."
            }
          >
            {(props) => (
              <Input
                {...props}
                maxLength={300}
                value={alt}
                onChange={(e) => {
                  update(
                    "Edit alt text",
                    (s) => {
                      if (s.type === "image") s.default.alt = e.target.value;
                    },
                    "alt",
                  );
                }}
              />
            )}
          </Field>
          <MediaLibraryDialog
            open={mediaOpen}
            onOpenChange={setMediaOpen}
            selectedId={mediaId}
            onSelect={(asset) => {
              update("Choose default image", (s) => {
                if (s.type === "image") s.default.mediaId = asset.id;
              });
            }}
          />
        </div>
      );
    }
    case "link":
      return (
        <LinkDefaultEditor
          label={label}
          url={slot.default.target?.kind === "url" ? slot.default.target.url : null}
          update={update}
        />
      );
  }
}

function LinkDefaultEditor({
  label,
  url,
  update,
}: {
  label: string;
  url: string | null;
  update: SlotUpdate;
}) {
  const [draft, setDraft] = useState(url ?? "");
  const [prev, setPrev] = useState(url);
  if (url !== prev) {
    setPrev(url);
    if (url !== null) setDraft(url);
  }
  const invalid = url !== null && draft !== "" && !urlPattern.test(draft);

  return (
    <div className="space-y-2">
      <Field label={label} hint="Owners usually pick a page; defaults can only link to a URL.">
        {(props) => (
          <Select
            {...props}
            value={url === null ? "none" : "url"}
            options={[
              { value: "none", label: "No link" },
              { value: "url", label: "External URL" },
            ]}
            onValueChange={(kind) => {
              update("Change default link", (s) => {
                if (s.type === "link")
                  s.default.target =
                    kind === "none"
                      ? null
                      : { kind: "url", url: urlPattern.test(draft) ? draft : "https://example.com" };
              });
            }}
          />
        )}
      </Field>
      {url !== null ? (
        <Field label="URL" error={invalid ? "Use an http(s), mailto: or tel: link." : undefined}>
          {(props) => (
            <Input
              {...props}
              value={draft}
              maxLength={2000}
              onChange={(e) => {
                const next = e.target.value;
                setDraft(next);
                if (urlPattern.test(next)) {
                  update(
                    "Edit default link",
                    (s) => {
                      if (s.type === "link") s.default.target = { kind: "url", url: next };
                    },
                    "url",
                  );
                }
              }}
            />
          )}
        </Field>
      ) : null}
    </div>
  );
}
