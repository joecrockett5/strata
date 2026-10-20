import {
  ANTIFORGERY_COOKIE,
  ANTIFORGERY_HEADER,
  ApiError,
  type components,
  isProblemDetails,
  readCookie,
} from "@strata/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export type MediaAsset = components["schemas"]["MediaDto"];

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const mediaKey = ["media"] as const;

export function mediaUrl(mediaId: string): string {
  return `/media/${mediaId}`;
}

export function useMediaLibrary() {
  return useQuery({
    queryKey: mediaKey,
    queryFn: async () => (await api.GET("/api/media")).data ?? [],
  });
}

/** Quick client-side check for a friendlier message; the server sniffs the bytes and decides. */
export function precheckUpload(file: File): string | undefined {
  if (!ACCEPTED_TYPES.includes(file.type as (typeof ACCEPTED_TYPES)[number]))
    return "Choose a JPEG, PNG or WebP image.";
  if (file.size > MAX_UPLOAD_BYTES) return "Images must be 5 MB or smaller.";
  return undefined;
}

export async function uploadMedia(file: File): Promise<MediaAsset> {
  const form = new FormData();
  form.append("file", file);
  const token = readCookie(ANTIFORGERY_COOKIE);
  const response = await fetch("/api/media", {
    method: "POST",
    body: form,
    credentials: "same-origin",
    headers: token ? { [ANTIFORGERY_HEADER]: token } : {},
  });
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      isProblemDetails(body) ? body : { status: response.status, title: "Upload failed" },
    );
  }
  return body as MediaAsset;
}

export function useUploadMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadMedia,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mediaKey }),
  });
}
