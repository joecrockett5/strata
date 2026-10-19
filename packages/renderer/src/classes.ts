import type { ColumnRatio, ImageNode, Theme } from "@strata/schema";

/** Joins truthy class names. Mirrors `Css.Classes` in Strata.Rendering. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/** "1:2" → "1-2", "16:9" → "16-9": class-safe form of a ratio. */
export function ratioToken(ratio: ColumnRatio | ImageNode["aspect"]): string {
  return ratio.replaceAll(":", "-");
}

export function themeClasses(theme: Theme): string {
  return cx(
    "st-site",
    `st-radius-${theme.radius}`,
    `st-font-heading-${theme.fonts.heading}`,
    `st-font-body-${theme.fonts.body}`,
  );
}

/** Theme colours as CSS custom properties. Mirrors `ThemeCss.Variables` in Strata.Rendering. */
export function themeVariables(theme: Theme): Record<string, string> {
  const c = theme.colors;
  return {
    "--st-color-primary": c.primary,
    "--st-color-on-primary": c.onPrimary,
    "--st-color-secondary": c.secondary,
    "--st-color-accent": c.accent,
    "--st-color-background": c.background,
    "--st-color-surface": c.surface,
    "--st-color-text": c.text,
    "--st-color-muted-text": c.mutedText,
  };
}
