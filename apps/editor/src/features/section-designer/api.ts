import type { components } from "@strata/api-client";
import type { SectionDefinition } from "@strata/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type SectionTypeSummary = components["schemas"]["SectionTypeSummary"];

/** A section type with its draft typed by the content schema (the server validated it). */
export interface SectionTypeDetail extends Omit<components["schemas"]["SectionTypeDetail"], "draft"> {
  draft: SectionDefinition;
}

export interface SectionTypeVersion extends Omit<
  components["schemas"]["SectionTypeVersionDto"],
  "definition"
> {
  definition: SectionDefinition;
}

const toDetail = (dto: components["schemas"]["SectionTypeDetail"]): SectionTypeDetail => ({
  ...dto,
  draft: dto.draft as SectionDefinition,
});

export const sectionTypeKeys = {
  all: ["section-types"] as const,
  list: (includeArchived: boolean) => ["section-types", "list", { includeArchived }] as const,
  detail: (id: string) => ["section-types", "detail", id] as const,
};

/** Strong ETag for a draft revision, as the API issues it. */
export const ifMatch = (revision: number) => ({ "If-Match": `"r${String(revision)}"` });

export function useSectionTypes(includeArchived: boolean) {
  return useQuery({
    queryKey: sectionTypeKeys.list(includeArchived),
    queryFn: async () =>
      (await api.GET("/api/section-types", { params: { query: { includeArchived } } })).data ?? [],
  });
}

export function useSectionType(id: string) {
  return useQuery({
    queryKey: sectionTypeKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.GET("/api/section-types/{id}", { params: { path: { id } } });
      if (!data) throw new Error("Section type not found");
      return toDetail(data);
    },
    // The designer owns the document once loaded; refetching would fight autosave.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export async function saveSectionTypeDraft(
  id: string,
  revision: number,
  draft: { name: string; category: string; definition: SectionDefinition },
): Promise<SectionTypeDetail> {
  const { data } = await api.PUT("/api/section-types/{id}", {
    params: { path: { id } },
    headers: ifMatch(revision),
    body: draft,
  });
  if (!data) throw new Error("Empty response");
  return toDetail(data);
}

export async function publishSectionTypeVersion(id: string, revision: number): Promise<SectionTypeVersion> {
  const { data } = await api.POST("/api/section-types/{id}/versions", {
    params: { path: { id } },
    headers: ifMatch(revision),
  });
  if (!data) throw new Error("Empty response");
  return { ...data, definition: data.definition as SectionDefinition };
}

export function useCreateSectionType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; category: string }) => {
      const { data } = await api.POST("/api/section-types", { body: { ...input, definition: null } });
      if (!data) throw new Error("Empty response");
      return toDetail(data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sectionTypeKeys.all }),
  });
}

export function useDuplicateSectionType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (
        await api.POST("/api/section-types/{id}/duplicate", {
          params: { path: { id } },
          body: { name: null },
        })
      ).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sectionTypeKeys.all }),
  });
}

export function useSetArchived() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      await (archived
        ? api.POST("/api/section-types/{id}/archive", { params: { path: { id } } })
        : api.POST("/api/section-types/{id}/restore", { params: { path: { id } } }));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sectionTypeKeys.all }),
  });
}
