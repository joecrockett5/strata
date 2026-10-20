import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router";
import { useSite, useSubmissions } from "../api";

/** Messages sent through the site's published contact forms. */
export function SubmissionsPage() {
  const { id = "" } = useParams();
  const site = useSite(id);
  const submissions = useSubmissions(id);
  const pageTitle = (pageId: string) =>
    site.data?.document.pages.find((p) => p.id === pageId)?.title ?? "Removed page";

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link
        to={`/sites/${id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden /> Back to the editor
      </Link>
      <h1 className="mb-1 text-2xl font-semibold">Messages</h1>
      <p className="mb-6 text-sm text-slate-600">
        Sent through the contact forms on {site.data?.name ?? "your site"}. Strata does not email them; check
        here.
      </p>
      {submissions.isPending ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {submissions.isError ? <p className="text-sm text-red-700">{submissions.error.message}</p> : null}
      {submissions.data?.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          No messages yet.
        </p>
      ) : null}
      <ul className="space-y-3">
        {submissions.data?.map((s) => (
          <li
            key={s.id}
            className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200"
            data-testid="submission"
          >
            <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-medium">{s.name}</span>
              <a href={`mailto:${s.email}`} className="text-sm text-blue-700 hover:underline">
                {s.email}
              </a>
              {s.phone ? <span className="text-sm text-slate-600">{s.phone}</span> : null}
              <span className="ml-auto text-xs text-slate-500">
                {new Date(s.createdAt).toLocaleString()} · {pageTitle(s.pageId)}
              </span>
            </div>
            <p className="text-sm whitespace-pre-wrap text-slate-800">{s.message}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
