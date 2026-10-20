import type { ImageValue } from "@strata/schema";
import { type SyntheticEvent, useState } from "react";
import { MediaLibrary } from "@/components/media/MediaLibraryDialog";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { mediaUrl } from "@/lib/media";

/**
 * Choose an image and its alt text for one use (alt text belongs to the use, not the file).
 * Mount it with a `key` per request so its form starts from the current value.
 */
export function ImageDialog({
  title,
  value,
  required,
  onApply,
  onClose,
}: {
  title: string;
  value: ImageValue;
  required: boolean;
  onApply: (value: ImageValue) => void;
  onClose: () => void;
}) {
  const [mediaId, setMediaId] = useState(value.mediaId);
  const [alt, setAlt] = useState(value.alt);
  const missingAlt = mediaId !== null && alt.trim() === "";

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    onApply({ $type: "image", mediaId, alt: alt.trim() });
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={title}
      className="w-[min(52rem,calc(100vw-2rem))]"
    >
      <form className="space-y-4" onSubmit={submit}>
        <MediaLibrary
          selectedId={mediaId}
          onSelect={(asset) => {
            setMediaId(asset.id);
          }}
        />
        <div className="flex items-start gap-4 border-t border-slate-200 pt-4">
          {mediaId ? (
            <img
              src={mediaUrl(mediaId)}
              alt=""
              className="size-20 shrink-0 rounded border border-slate-200 object-cover"
              data-testid="image-dialog-preview"
            />
          ) : (
            <span className="flex size-20 shrink-0 items-center justify-center rounded border border-dashed border-slate-300 text-xs text-slate-400">
              No image
            </span>
          )}
          <Field
            className="flex-1"
            label="Alt text"
            hint="Describe what the image shows for people who can't see it. Required before publishing."
            error={missingAlt ? "Add alt text before publishing." : undefined}
          >
            {(props) => (
              <Input
                {...props}
                maxLength={300}
                value={alt}
                onChange={(e) => {
                  setAlt(e.target.value);
                }}
              />
            )}
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          {mediaId && !required ? (
            <Button
              variant="ghost"
              className="mr-auto"
              onClick={() => {
                setMediaId(null);
              }}
            >
              Remove image
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Apply</Button>
        </div>
      </form>
    </Dialog>
  );
}
