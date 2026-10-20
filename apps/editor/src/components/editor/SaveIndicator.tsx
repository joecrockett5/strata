import { AlertTriangle, Check, CloudUpload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { SaveStatus } from "@/lib/useAutosave";

/** Autosave status for the editor toolbar; announced politely to screen readers. */
export function SaveIndicator({ status }: { status: SaveStatus }) {
  const content = {
    saved: { icon: <Check className="size-3.5" />, text: "Saved", tone: "text-slate-500" },
    pending: { icon: <CloudUpload className="size-3.5" />, text: "Unsaved changes", tone: "text-slate-500" },
    saving: { icon: <Loader2 className="size-3.5 animate-spin" />, text: "Saving…", tone: "text-slate-500" },
    conflict: {
      icon: <AlertTriangle className="size-3.5" />,
      text: "Changed elsewhere",
      tone: "text-red-700",
    },
    invalid: {
      icon: <AlertTriangle className="size-3.5" />,
      text: "Not saved: fix the highlighted problems",
      tone: "text-red-700",
    },
    error: {
      icon: <AlertTriangle className="size-3.5" />,
      text: "Save failed, retrying on next change",
      tone: "text-red-700",
    },
  }[status.kind];

  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1 text-xs ${content.tone}`}
      data-testid="save-status"
      data-status={status.kind}
    >
      {content.icon}
      {content.text}
    </span>
  );
}

/** Blocking dialog shown when a save hits 409: someone else saved first. */
export function ConflictDialog({ open }: { open: boolean }) {
  return (
    <Dialog
      open={open}
      onOpenChange={() => undefined}
      title="Changed elsewhere"
      description="This draft was saved from another tab or by someone else. Reload to get the latest version; your unsaved changes here cannot be merged."
    >
      <div className="flex justify-end">
        <Button
          onClick={() => {
            window.location.reload();
          }}
        >
          Reload
        </Button>
      </div>
    </Dialog>
  );
}
