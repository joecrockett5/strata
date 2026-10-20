import type { LinkValue, Page } from "@strata/schema";
import { type SyntheticEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";

const urlPattern = /^(https?:\/\/|mailto:|tel:)/i;

type Kind = "none" | "page" | "url";

/** Edits a button's label and link (internal page picker or external URL). Mount with a `key` per request. */
export function ButtonDialog({
  label,
  labelEditable,
  maxLength,
  link,
  pages,
  onApply,
  onClose,
}: {
  label: string;
  labelEditable: boolean;
  maxLength: number | undefined;
  link: LinkValue;
  pages: readonly Page[];
  onApply: (label: string, link: LinkValue) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(label);
  const [kind, setKind] = useState<Kind>(link.target?.kind ?? "none");
  const [pageId, setPageId] = useState(
    link.target?.kind === "page" ? link.target.pageId : (pages[0]?.id ?? ""),
  );
  const [url, setUrl] = useState(link.target?.kind === "url" ? link.target.url : "https://");
  const urlInvalid = kind === "url" && !urlPattern.test(url.trim());

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (urlInvalid) return;
    const target =
      kind === "none"
        ? null
        : kind === "page"
          ? { kind: "page" as const, pageId }
          : { kind: "url" as const, url: url.trim() };
    onApply(text, { $type: "link", target });
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Button"
    >
      <form className="space-y-4" onSubmit={submit}>
        <Field label="Label" hint={labelEditable ? undefined : "The label is locked by the template."}>
          {(props) => (
            <Input
              {...props}
              value={text}
              disabled={!labelEditable}
              maxLength={maxLength}
              onChange={(e) => {
                setText(e.target.value);
              }}
            />
          )}
        </Field>
        <div className="space-y-1">
          <span className="block text-xs font-medium text-slate-700">Link to</span>
          <Segmented
            label="Link type"
            value={kind}
            onValueChange={setKind}
            options={[
              { value: "page", label: "A page" },
              { value: "url", label: "External URL" },
              { value: "none", label: "Nothing" },
            ]}
          />
        </div>
        {kind === "page" ? (
          <Field label="Page">
            {(props) => (
              <Select
                {...props}
                value={pageId}
                options={pages.map((p) => ({ value: p.id, label: p.title }))}
                onValueChange={setPageId}
              />
            )}
          </Field>
        ) : null}
        {kind === "url" ? (
          <Field label="URL" error={urlInvalid ? "Use an http(s), mailto: or tel: link." : undefined}>
            {(props) => (
              <Input
                {...props}
                value={url}
                maxLength={2000}
                onChange={(e) => {
                  setUrl(e.target.value);
                }}
              />
            )}
          </Field>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={urlInvalid}>
            Apply
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
