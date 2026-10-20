import { ApiError } from "@strata/api-client";
import { AlertCircle, AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { getPublishChecks, type PublishChecks, type PublishIssue, publishSite } from "../api";
import type { EditorActionsApi } from "../SiteEditor";

type State =
  | { kind: "checking" }
  | { kind: "checked"; checks: PublishChecks }
  | { kind: "publishing"; checks: PublishChecks }
  | { kind: "published"; version: number; url: string }
  | { kind: "failed"; message: string };

/**
 * Saves the draft, runs the server's publish checks across all pages and publishes when no
 * errors remain. Clicking an issue jumps to the section concerned.
 */
export function PublishDialog({
  siteId,
  editor: initialEditor,
  onClose,
  onPublished,
}: {
  siteId: string;
  editor: EditorActionsApi;
  onClose: () => void;
  onPublished: () => void;
}) {
  // The editor API object is rebuilt on every render; the dialog only needs the first one.
  const [editor] = useState(initialEditor);
  const [state, setState] = useState<State>({ kind: "checking" });

  useEffect(() => {
    const run = { cancelled: false };
    void (async () => {
      try {
        await editor.flush();
        const s = editor.store.getState();
        if (s.version !== s.savedVersion)
          throw new Error("The latest changes could not be saved. Fix them before publishing.");
        const checks = await getPublishChecks(siteId);
        if (!run.cancelled) setState({ kind: "checked", checks });
      } catch (error) {
        if (!run.cancelled)
          setState({ kind: "failed", message: error instanceof Error ? error.message : "Checks failed." });
      }
    })();
    return () => {
      run.cancelled = true;
    };
  }, [editor, siteId]);

  const publish = async (checks: PublishChecks) => {
    setState({ kind: "publishing", checks });
    try {
      const result = await publishSite(siteId, checks.revision);
      setState({ kind: "published", version: result.version, url: result.url });
      onPublished();
    } catch (error) {
      const message =
        error instanceof ApiError && error.isConflict
          ? "The draft changed since the checks ran. Close and publish again."
          : error instanceof Error
            ? error.message
            : "Publishing failed.";
      setState({ kind: "failed", message });
    }
  };

  const jump = (issue: PublishIssue) => {
    editor.focus(issue.pageId, issue.instanceId);
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Publish site"
      description="Every page is checked before publishing. Errors must be fixed; warnings are advice."
      className="w-[min(40rem,calc(100vw-2rem))]"
    >
      <div data-testid="publish-dialog">
        {state.kind === "checking" ? <p className="text-sm text-slate-500">Saving and checking…</p> : null}
        {state.kind === "failed" ? (
          <p role="alert" className="text-sm text-red-700">
            {state.message}
          </p>
        ) : null}
        {state.kind === "checked" || state.kind === "publishing" ? (
          <>
            <IssueGroup
              title="Errors"
              tone="error"
              issues={state.checks.issues.filter((i) => i.severity === "error")}
              onJump={jump}
            />
            <IssueGroup
              title="Warnings"
              tone="warning"
              issues={state.checks.issues.filter((i) => i.severity === "warning")}
              onJump={jump}
            />
            {state.checks.issues.length === 0 ? (
              <p className="flex items-center gap-1.5 text-sm text-emerald-800">
                <CheckCircle2 className="size-4" aria-hidden /> All checks passed.
              </p>
            ) : null}
            <div className="mt-5 flex items-center justify-end gap-2">
              {state.checks.errors > 0 ? (
                <span className="mr-auto text-sm text-red-700">
                  Fix {state.checks.errors === 1 ? "the error" : `${String(state.checks.errors)} errors`} to
                  publish.
                </span>
              ) : null}
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button
                disabled={state.checks.errors > 0 || state.kind === "publishing"}
                onClick={() => void publish(state.checks)}
              >
                {state.kind === "publishing" ? "Publishing…" : "Publish now"}
              </Button>
            </div>
          </>
        ) : null}
        {state.kind === "published" ? (
          <div className="space-y-4">
            <p
              role="status"
              className="flex items-center gap-1.5 text-sm text-emerald-800"
              data-testid="publish-result"
            >
              <CheckCircle2 className="size-4" aria-hidden /> Published version {state.version}. Your site is
              live.
            </p>
            <a
              href={state.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline"
              data-testid="public-url"
            >
              {window.location.origin}
              {state.url} <ExternalLink className="size-3.5" aria-hidden />
            </a>
            <div className="flex justify-end">
              <Button onClick={onClose}>Done</Button>
            </div>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}

function IssueGroup({
  title,
  tone,
  issues,
  onJump,
}: {
  title: string;
  tone: "error" | "warning";
  issues: PublishIssue[];
  onJump: (issue: PublishIssue) => void;
}) {
  if (issues.length === 0) return null;
  const Icon = tone === "error" ? AlertCircle : AlertTriangle;
  return (
    <section aria-label={title} className="mb-4">
      <h3
        className={
          tone === "error"
            ? "mb-1 text-sm font-semibold text-red-800"
            : "mb-1 text-sm font-semibold text-amber-800"
        }
      >
        {title} ({issues.length})
      </h3>
      <ul className="space-y-1">
        {issues.map((issue) => (
          <li key={`${issue.code}:${issue.path}`}>
            <button
              type="button"
              disabled={!issue.instanceId && !issue.pageId}
              onClick={() => {
                onJump(issue);
              }}
              className="flex w-full items-start gap-1.5 rounded px-1.5 py-1 text-left text-sm hover:bg-slate-100 disabled:hover:bg-transparent"
              data-testid={`publish-issue-${issue.code}`}
            >
              <Icon
                className={
                  tone === "error"
                    ? "mt-0.5 size-4 shrink-0 text-red-600"
                    : "mt-0.5 size-4 shrink-0 text-amber-600"
                }
                aria-hidden
              />
              <span>{issue.message}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
