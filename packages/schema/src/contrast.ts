// WCAG 2.x contrast for theme colours. Mirrored in .NET for publish checks; both are tested
// against fixtures/contrast.json.
import type { Theme } from "./types";

/** WCAG AA minimum for normal-size text. */
export const AA_NORMAL_TEXT = 4.5;

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of a `#rrggbb` colour. */
export function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`Not a #rrggbb colour: ${hex}`);
  const [r, g, b] = match.slice(1).map((part) => channel(parseInt(part, 16))) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground: string, background: string): number {
  const [high, low] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (a, b) => b - a,
  ) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

export interface ContrastCheck {
  /** Theme tokens compared, e.g. `["text", "background"]`. */
  pair: readonly [keyof Theme["colors"], keyof Theme["colors"]];
  ratio: number;
  passes: boolean;
}

/** The pairs the brief requires: body text on the background, and onPrimary on primary. */
export const checkedPairs = [
  ["text", "background"],
  ["onPrimary", "primary"],
] as const satisfies readonly (readonly [keyof Theme["colors"], keyof Theme["colors"]])[];

export function themeContrast(theme: Theme): ContrastCheck[] {
  return checkedPairs.map((pair) => {
    const ratio = contrastRatio(theme.colors[pair[0]], theme.colors[pair[1]]);
    return { pair, ratio, passes: ratio >= AA_NORMAL_TEXT };
  });
}
