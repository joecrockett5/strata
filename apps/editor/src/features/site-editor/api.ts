import type { components } from "@strata/api-client";
import type { SectionDefinition, SiteDocument } from "@strata/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PublishedSection } from "./siteModel";

type Schemas = components["schemas"];

// Content travels as opaque JSON in OpenAPI; the server validated it against the content schema.
const toSection = (dto: Schemas["PublishedSectionDto"]): PublishedSection => ({
  ...dto,
  definition: dto.definition as SectionDefinition,
});

export type SiteSummary = Schemas["SiteSummary"];
export type TemplateSummary = Schemas["TemplateSummary"];
export type PublishedTemplate = Schemas["PublishedTemplateDto"];

export interface SiteDetail extends Omit<Schemas["SiteDetail"], "document" | "sections"> {
  document: SiteDocument;
  sections: PublishedSection[];
}

export interface TemplateDetail extends Omit<Schemas["TemplateDetail"], "document" | "sections"> {
  document: SiteDocument;
  sections: PublishedSection[];
}

const toSite = (dto: Schemas["SiteDetail"]): SiteDetail => ({
  ...dto,
  document: dto.document as SiteDocument,
  sections: dto.sections.map(toSection),
});
const toTemplate = (dto: Schemas["TemplateDetail"]): TemplateDetail => ({
  ...dto,
  document: dto.document as SiteDocument,
  sections: dto.sections.map(toSection),
});

const ifMatch = (revision: number) => ({ "If-Match": `"r${String(revision)}"` });

function required<T>(data: T | undefined): T {
  if (data === undefined) throw new Error("Empty response");
  return data;
}

// ---------------------------------------------------------------------------------------------
// Library

export function useLibrary() {
  return useQuery({
    queryKey: ["library"],
    queryFn: async () => required((await api.GET("/api/library")).data).map(toSection),
  });
}

// ---------------------------------------------------------------------------------------------
// Sites

export const siteKeys = {
  all: ["sites"] as const,
  detail: (id: string) => ["sites", id] as const,
};

export function useSites() {
  return useQuery({
    queryKey: siteKeys.all,
    queryFn: async () => required((await api.GET("/api/sites")).data),
  });
}

export function useSite(id: string) {
  return useQuery({
    queryKey: siteKeys.detail(id),
    queryFn: async () =>
      toSite(required((await api.GET("/api/sites/{id}", { params: { path: { id } } })).data)),
    // The editor owns the draft once loaded; refetching would fight autosave.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useCreateSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; slug: string; templateId: string | null }) =>
      toSite(required((await api.POST("/api/sites", { body })).data)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: siteKeys.all }),
  });
}

export function useRenameSite(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; slug: string }) =>
      required((await api.PATCH("/api/sites/{id}", { params: { path: { id } }, body })).data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: siteKeys.all }),
  });
}

export function useDeleteSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.DELETE("/api/sites/{id}", { params: { path: { id } } });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: siteKeys.all }),
  });
}

export async function saveSiteDraft(id: string, revision: number, document: SiteDocument) {
  const saved = required(
    (
      await api.PUT("/api/sites/{id}/draft", {
        params: { path: { id } },
        headers: ifMatch(revision),
        body: { document },
      })
    ).data,
  );
  return { ...saved, document: saved.document as SiteDocument };
}

// ---------------------------------------------------------------------------------------------
// Templates

export const templateKeys = {
  all: ["templates"] as const,
  list: (includeArchived: boolean) => ["templates", "list", { includeArchived }] as const,
  detail: (id: string) => ["templates", "detail", id] as const,
  published: ["templates", "published"] as const,
};

export function useTemplates(includeArchived: boolean) {
  return useQuery({
    queryKey: templateKeys.list(includeArchived),
    queryFn: async () =>
      required((await api.GET("/api/templates", { params: { query: { includeArchived } } })).data),
  });
}

export function usePublishedTemplates() {
  return useQuery({
    queryKey: templateKeys.published,
    queryFn: async () => required((await api.GET("/api/templates/published")).data),
  });
}

export function useTemplate(id: string) {
  return useQuery({
    queryKey: templateKeys.detail(id),
    queryFn: async () =>
      toTemplate(required((await api.GET("/api/templates/{id}", { params: { path: { id } } })).data)),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; description: string | null; themePresetId: string | null }) =>
      toTemplate(required((await api.POST("/api/templates", { body })).data)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: templateKeys.all }),
  });
}

export function useSetTemplateArchived() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      await (archived
        ? api.POST("/api/templates/{id}/archive", { params: { path: { id } } })
        : api.POST("/api/templates/{id}/restore", { params: { path: { id } } }));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: templateKeys.all }),
  });
}

export interface TemplateDraft {
  name: string;
  description: string;
  thumbnailMediaId: string | null;
  document: SiteDocument;
}

export async function saveTemplateDraft(
  id: string,
  revision: number,
  draft: TemplateDraft,
): Promise<TemplateDetail> {
  return toTemplate(
    required(
      (
        await api.PUT("/api/templates/{id}", {
          params: { path: { id } },
          headers: ifMatch(revision),
          body: draft,
        })
      ).data,
    ),
  );
}

export async function publishTemplateVersion(id: string, revision: number) {
  return required(
    (await api.POST("/api/templates/{id}/versions", { params: { path: { id } }, headers: ifMatch(revision) }))
      .data,
  );
}
