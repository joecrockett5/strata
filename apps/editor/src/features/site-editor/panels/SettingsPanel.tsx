import { versionKey } from "@strata/schema";
import { ImageIcon } from "lucide-react";
import { type SyntheticEvent, useState } from "react";
import { useStore } from "zustand";
import { MediaLibraryDialog } from "@/components/media/MediaLibraryDialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { mediaUrl } from "@/lib/media";
import { useLibrary, useRenameSite } from "../api";
import { ImageDialog } from "../dialogs/ImageDialog";
import { useSiteEditor } from "../editorState";
import { sectionPermissions } from "../siteModel";

export interface SiteIdentity {
  id: string;
  name: string;
  slug: string;
}

/** Firm name, logo, global header/footer, and either the site's address or the template's metadata. */
export function SettingsPanel({
  site: identity,
  onRenamed,
}: {
  site?: SiteIdentity;
  onRenamed?: (identity: SiteIdentity) => void;
}) {
  const { store, author, commands, sections } = useSiteEditor();
  const site = useStore(store, (s) => s.doc.site);
  const template = useStore(store, (s) => s.doc.template);
  const library = useLibrary();
  const [logoOpen, setLogoOpen] = useState(false);
  const [thumbnailOpen, setThumbnailOpen] = useState(false);

  const globalSelect = (region: "header" | "footer") => {
    const current = site[region];
    const locked = current !== null && !sectionPermissions(current, author).remove;
    const options = [
      { value: "", label: "None" },
      ...(current && !library.data?.some((s) => versionKey(s) === versionKey(current))
        ? [
            {
              value: versionKey(current),
              label: `${sections.get(versionKey(current))?.name ?? "Current"} (v${String(current.version)})`,
            },
          ]
        : []),
      ...(library.data ?? []).map((s) => ({ value: versionKey(s), label: `${s.name} · ${s.category}` })),
    ];
    return (
      <Field
        label={region === "header" ? "Header (all pages)" : "Footer (all pages)"}
        hint={locked ? "Required by the template." : undefined}
      >
        {(props) => (
          <Select
            {...props}
            disabled={locked}
            value={current ? versionKey(current) : ""}
            options={options}
            onValueChange={(key) => {
              if (current && key === versionKey(current)) return;
              commands.setGlobal(region, library.data?.find((s) => versionKey(s) === key) ?? null);
            }}
          />
        )}
      </Field>
    );
  };

  return (
    <div className="space-y-5 p-3">
      {identity ? (
        <SiteAddressForm
          key={`${identity.name}|${identity.slug}`}
          identity={identity}
          {...(onRenamed ? { onRenamed } : {})}
        />
      ) : null}

      {template ? (
        <section aria-label="Template" className="space-y-3">
          <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Template</h2>
          <Field label="Template name">
            {(props) => (
              <Input
                {...props}
                maxLength={120}
                value={template.name}
                onChange={(e) => {
                  commands.setTemplateMeta(
                    "Rename template",
                    (m) => {
                      m.name = e.target.value;
                    },
                    "name",
                  );
                }}
              />
            )}
          </Field>
          <Field label="Description" hint="Shown to owners choosing a starting point.">
            {(props) => (
              <Textarea
                {...props}
                maxLength={500}
                value={template.description}
                onChange={(e) => {
                  commands.setTemplateMeta(
                    "Edit description",
                    (m) => {
                      m.description = e.target.value;
                    },
                    "description",
                  );
                }}
              />
            )}
          </Field>
          <div className="flex items-center gap-3">
            {template.thumbnailMediaId ? (
              <img
                src={mediaUrl(template.thumbnailMediaId)}
                alt=""
                className="h-16 w-24 rounded border border-slate-200 object-cover"
              />
            ) : (
              <span className="flex h-16 w-24 items-center justify-center rounded border border-dashed border-slate-300 text-slate-400">
                <ImageIcon className="size-5" aria-hidden />
              </span>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setThumbnailOpen(true);
              }}
            >
              {template.thumbnailMediaId ? "Change thumbnail" : "Choose thumbnail"}
            </Button>
          </div>
          <MediaLibraryDialog
            open={thumbnailOpen}
            onOpenChange={setThumbnailOpen}
            selectedId={template.thumbnailMediaId}
            onSelect={(asset) => {
              commands.setTemplateMeta("Change thumbnail", (m) => {
                m.thumbnailMediaId = asset.id;
              });
            }}
          />
        </section>
      ) : null}

      <section aria-label="Site settings" className="space-y-3">
        <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Site settings</h2>
        <Field label="Firm name" hint="Shown in the navigation and page titles.">
          {(props) => (
            <Input
              {...props}
              maxLength={120}
              value={site.settings.firmName}
              onChange={(e) => {
                commands.change(
                  "Change firm name",
                  (d) => {
                    d.settings.firmName = e.target.value;
                  },
                  "firmName",
                );
              }}
            />
          )}
        </Field>
        <div className="space-y-1">
          <span className="block text-xs font-medium text-slate-700">Logo</span>
          <div className="flex items-center gap-3">
            {site.settings.logo?.mediaId ? (
              <img
                src={mediaUrl(site.settings.logo.mediaId)}
                alt={site.settings.logo.alt}
                className="h-12 max-w-32 rounded border border-slate-200 object-contain p-1"
              />
            ) : (
              <span className="text-xs text-slate-500">No logo</span>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setLogoOpen(true);
              }}
            >
              {site.settings.logo ? "Change logo" : "Add logo"}
            </Button>
            {site.settings.logo ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  commands.change("Remove logo", (d) => {
                    d.settings.logo = null;
                  });
                }}
              >
                Remove
              </Button>
            ) : null}
          </div>
        </div>
        {logoOpen ? (
          <ImageDialog
            title="Logo"
            value={site.settings.logo ?? { $type: "image", mediaId: null, alt: site.settings.firmName }}
            required={false}
            onClose={() => {
              setLogoOpen(false);
            }}
            onApply={(logo) => {
              commands.change("Change logo", (d) => {
                d.settings.logo = logo.mediaId ? logo : null;
              });
            }}
          />
        ) : null}
        {globalSelect("header")}
        {globalSelect("footer")}
      </section>
    </div>
  );
}

function SiteAddressForm({
  identity,
  onRenamed,
}: {
  identity: SiteIdentity;
  onRenamed?: (identity: SiteIdentity) => void;
}) {
  const rename = useRenameSite(identity.id);
  const [name, setName] = useState(identity.name);
  const [slug, setSlug] = useState(identity.slug);
  const changed = name !== identity.name || slug !== identity.slug;

  const submit = async (event: SyntheticEvent) => {
    event.preventDefault();
    const saved = await rename.mutateAsync({ name: name.trim(), slug: slug.trim().toLowerCase() });
    onRenamed?.({ id: identity.id, name: saved.name, slug: saved.slug });
  };

  return (
    <form className="space-y-3" aria-label="Site" onSubmit={(e) => void submit(e)}>
      <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Site</h2>
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
      <Field label="Address" hint={`Published at /s/${slug}`} error={rename.error?.message}>
        {(props) => (
          <Input
            {...props}
            required
            minLength={3}
            maxLength={40}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value.toLowerCase());
            }}
          />
        )}
      </Field>
      <Button type="submit" size="sm" variant="secondary" disabled={!changed || rename.isPending}>
        Save name and address
      </Button>
    </form>
  );
}
