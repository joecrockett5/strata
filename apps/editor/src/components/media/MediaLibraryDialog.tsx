import { ImageUp } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import {
  ACCEPTED_TYPES,
  type MediaAsset,
  mediaUrl,
  precheckUpload,
  useMediaLibrary,
  useUploadMedia,
} from "@/lib/media";

/** Pick an uploaded image or upload a new one (JPEG/PNG/WebP up to 5 MB; SVG is rejected). */
export function MediaLibraryDialog({
  open,
  onOpenChange,
  onSelect,
  selectedId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (asset: MediaAsset) => void;
  selectedId?: string | null;
}) {
  const library = useMediaLibrary();
  const upload = useUploadMedia();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();

  const onFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const problem = precheckUpload(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(undefined);
    try {
      onSelect(await upload.mutateAsync(file));
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      if (input.current) input.current.value = "";
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Media library"
      description="JPEG, PNG or WebP, up to 5 MB."
      className="w-[min(48rem,calc(100vw-2rem))]"
    >
      <div className="mb-4 flex items-center gap-3">
        <input
          ref={input}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="sr-only"
          id="media-upload"
          data-testid="media-upload-input"
          onChange={(e) => void onFiles(e.target.files)}
        />
        <Button variant="secondary" onClick={() => input.current?.click()} disabled={upload.isPending}>
          <ImageUp className="size-4" aria-hidden /> {upload.isPending ? "Uploading…" : "Upload image"}
        </Button>
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </div>
      {library.data?.length === 0 ? (
        <p className="text-sm text-slate-500">No images yet. Upload one to get started.</p>
      ) : null}
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4" aria-label="Uploaded images">
        {library.data?.map((asset) => (
          <li key={asset.id}>
            <button
              type="button"
              onClick={() => {
                onSelect(asset);
                onOpenChange(false);
              }}
              className={cn(
                "group block w-full overflow-hidden rounded-md border-2 text-left",
                asset.id === selectedId ? "border-blue-600" : "border-transparent hover:border-slate-300",
              )}
            >
              <img
                src={mediaUrl(asset.id)}
                alt=""
                className="aspect-square w-full bg-slate-100 object-cover"
              />
              <span className="block truncate px-1 py-0.5 text-xs text-slate-600">{asset.fileName}</span>
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
