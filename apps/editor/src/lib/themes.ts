import type { components } from "@strata/api-client";
import type { Theme } from "@strata/schema";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export interface ThemePreset {
  id: string;
  name: string;
  theme: Theme;
}

/** Used until presets load (mirrors `Theme.Default` in Strata.Domain). */
export const fallbackTheme: Theme = {
  colors: {
    primary: "#1f4e5f",
    onPrimary: "#ffffff",
    secondary: "#4a6b5d",
    accent: "#c9822b",
    background: "#ffffff",
    surface: "#f3f5f4",
    text: "#1c2321",
    mutedText: "#55605c",
  },
  fonts: { heading: "transitional", body: "system-ui" },
  radius: "small",
};

// Content travels as opaque JSON in OpenAPI; the server validated it against the content schema.
const toPreset = (dto: components["schemas"]["ThemePresetDto"]): ThemePreset => ({
  ...dto,
  theme: dto.theme as Theme,
});

export function useThemePresets() {
  return useQuery({
    queryKey: ["theme-presets"],
    queryFn: async () => ((await api.GET("/api/theme-presets")).data ?? []).map(toPreset),
    staleTime: 5 * 60_000,
  });
}
