import { FileText, LayoutTemplate } from "lucide-react";
import { type SyntheticEvent, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { mediaUrl } from "@/lib/media";
import { useCreateSite, usePublishedTemplates } from "../api";
import { slugify } from "../siteModel";

const siteSlugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Step 1: choose a starter template or blank. Step 2 (same page): name and address. */
export function NewSitePage() {
  const templates = usePublishedTemplates();
  const create = useCreateSite();
  const navigate = useNavigate();
  const [templateId, setTemplateId] = useState<string | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const effectiveSlug = slugEdited ? slug : slugify(name).slice(0, 40).replace(/-+$/, "");
  const slugError =
    effectiveSlug !== "" && (!siteSlugPattern.test(effectiveSlug) || effectiveSlug.length < 3)
      ? "3–40 lower-case letters, digits and single hyphens."
      : undefined;

  const submit = async (event: SyntheticEvent) => {
    event.preventDefault();
    if (templateId === undefined || slugError) return;
    const site = await create.mutateAsync({ name: name.trim(), slug: effectiveSlug, templateId });
    await navigate(`/sites/${site.id}`);
  };

  const choice = (
    id: string | null,
    title: string,
    description: string,
    extra: React.ReactNode,
    testId: string,
  ) => (
    <li key={id ?? "blank"}>
      <button
        type="button"
        aria-pressed={templateId === id}
        onClick={() => {
          setTemplateId(id);
        }}
        data-testid={testId}
        className={cn(
          "flex h-full w-full flex-col overflow-hidden rounded-lg border-2 bg-white text-left shadow-sm",
          templateId === id
            ? "border-blue-600"
            : "border-transparent ring-1 ring-slate-200 hover:ring-slate-400",
        )}
      >
        {extra}
        <span className="block p-3">
          <span className="block font-medium">{title}</span>
          <span className="block text-xs text-slate-600">{description}</span>
        </span>
      </button>
    </li>
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-1 text-2xl font-semibold">New site</h1>
      <p className="mb-6 text-sm text-slate-600">
        Start from a starter template or a blank page. Your site is an independent copy; later template
        changes won't affect it.
      </p>

      <form onSubmit={(e) => void submit(e)} className="space-y-8">
        <fieldset>
          <legend className="mb-3 text-sm font-semibold">1. Choose a starting point</legend>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.data?.map((t) =>
              choice(
                t.id,
                t.name,
                `${t.description} · ${String(t.pageCount)} ${t.pageCount === 1 ? "page" : "pages"}`,
                t.thumbnailMediaId ? (
                  <img
                    src={mediaUrl(t.thumbnailMediaId)}
                    alt=""
                    className="aspect-video w-full bg-slate-100 object-cover"
                  />
                ) : (
                  <span className="flex aspect-video w-full items-center justify-center bg-slate-100 text-slate-400">
                    <LayoutTemplate className="size-8" aria-hidden />
                  </span>
                ),
                `template-${t.name}`,
              ),
            )}
            {choice(
              null,
              "Blank site",
              "One empty home page and the default theme.",
              <span className="flex aspect-video w-full items-center justify-center bg-slate-50 text-slate-400">
                <FileText className="size-8" aria-hidden />
              </span>,
              "template-blank",
            )}
          </ul>
        </fieldset>

        <fieldset disabled={templateId === undefined} className="max-w-md space-y-4 disabled:opacity-50">
          <legend className="mb-3 text-sm font-semibold">2. Name your site</legend>
          <Field label="Site name">
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
          <Field
            label="Address"
            hint={`Your site will be published at /s/${effectiveSlug || "…"}`}
            error={slugError}
          >
            {(props) => (
              <Input
                {...props}
                required
                maxLength={40}
                value={effectiveSlug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(e.target.value.toLowerCase());
                }}
              />
            )}
          </Field>
          {create.error ? (
            <p role="alert" className="text-sm text-red-700">
              {create.error.message}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={create.isPending || templateId === undefined || slugError !== undefined}
          >
            Create site
          </Button>
        </fieldset>
      </form>
    </main>
  );
}
