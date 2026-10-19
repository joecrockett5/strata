import { ApiError, type components } from "@strata/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type CurrentUser = components["schemas"]["CurrentUserResponse"];
export type Role = "Designer" | "SiteOwner";

export const currentUserKey = ["auth", "me"] as const;

async function fetchCurrentUser(): Promise<CurrentUser | null> {
  try {
    const { data } = await api.GET("/api/auth/me");
    return data ?? null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

/** Ensures the XSRF-TOKEN cookie exists before an unsafe request. */
export async function ensureAntiforgeryToken(): Promise<void> {
  await api.GET("/api/auth/antiforgery");
}

export function useCurrentUser() {
  return useQuery({ queryKey: currentUserKey, queryFn: fetchCurrentUser, staleTime: 60_000 });
}

export function hasRole(user: CurrentUser | null | undefined, role: Role): boolean {
  return user?.roles.includes(role) ?? false;
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      await ensureAntiforgeryToken();
      const { data } = await api.POST("/api/auth/login", { body: credentials });
      return data ?? null;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(currentUserKey, user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.POST("/api/auth/logout");
    },
    onSuccess: () => {
      // Update (not clear) the auth query so mounted route guards observe the sign-out,
      // then drop every other cached query belonging to the previous user.
      queryClient.setQueryData(currentUserKey, null);
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== currentUserKey[0] });
    },
  });
}
