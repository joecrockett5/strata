// Choices offered by the properties panel. Each list is typed against the generated schema, so
// a value the schema does not allow fails to compile.
import type {
  Align,
  ColumnRatio,
  ColumnsNode,
  ContentWidth,
  ImageNode,
  ButtonNode,
  RepeaterNode,
  SectionBackground,
  Spacing,
  StackNode,
} from "@strata/schema";
import { columnRatioParts } from "@strata/schema";

interface Option<T extends string> {
  value: T;
  label: string;
}

export const spacingOptions: readonly Option<Spacing>[] = [
  { value: "none", label: "None" },
  { value: "xs", label: "XS" },
  { value: "sm", label: "S" },
  { value: "md", label: "M" },
  { value: "lg", label: "L" },
  { value: "xl", label: "XL" },
  { value: "2xl", label: "2XL" },
];

export const backgroundOptions: readonly Option<SectionBackground>[] = [
  { value: "background", label: "Background" },
  { value: "surface", label: "Surface" },
  { value: "primary", label: "Primary" },
];

export const widthOptions: readonly Option<ContentWidth>[] = [
  { value: "narrow", label: "Narrow" },
  { value: "standard", label: "Standard" },
  { value: "wide", label: "Wide" },
  { value: "full", label: "Full" },
];

export const alignOptions: readonly Option<Align>[] = [
  { value: "start", label: "Start" },
  { value: "center", label: "Center" },
  { value: "end", label: "End" },
];

export const stackAlignOptions: readonly Option<StackNode["align"]>[] = [
  ...alignOptions,
  { value: "stretch", label: "Stretch" },
];

export const valignOptions: readonly Option<ColumnsNode["valign"]>[] = [
  { value: "start", label: "Top" },
  { value: "center", label: "Middle" },
  { value: "end", label: "Bottom" },
  { value: "stretch", label: "Stretch" },
];

export const stackAtOptions: readonly Option<ColumnsNode["stackAt"]>[] = [
  { value: "tablet", label: "Tablet and below" },
  { value: "mobile", label: "Mobile only" },
];

const allRatios: readonly ColumnRatio[] = [
  "1",
  "1:1",
  "1:2",
  "2:1",
  "1:3",
  "3:1",
  "1:1:1",
  "1:2:1",
  "2:1:1",
  "1:1:2",
  "1:1:1:1",
];

/** Ratio presets valid for a column count (the server rejects a mismatch at publish). */
export function ratioOptions(count: number): Option<ColumnRatio>[] {
  return allRatios
    .filter((ratio) => columnRatioParts(ratio).length === count)
    .map((ratio) => ({ value: ratio, label: ratio }));
}

/** The even split for a column count. */
export function evenRatio(count: number): ColumnRatio {
  return (["1", "1:1", "1:1:1", "1:1:1:1"] as const)[Math.min(Math.max(count, 1), 4) - 1] ?? "1";
}

export const aspectOptions: readonly Option<ImageNode["aspect"]>[] = [
  { value: "auto", label: "Original" },
  { value: "1:1", label: "1:1" },
  { value: "4:3", label: "4:3" },
  { value: "3:2", label: "3:2" },
  { value: "16:9", label: "16:9" },
  { value: "3:4", label: "3:4" },
];

export const fitOptions: readonly Option<ImageNode["fit"]>[] = [
  { value: "cover", label: "Cover (crop)" },
  { value: "contain", label: "Contain" },
];

export const radiusOptions: readonly Option<ImageNode["radius"]>[] = [
  { value: "none", label: "None" },
  { value: "theme", label: "Theme" },
  { value: "full", label: "Full" },
];

export const variantOptions: readonly Option<ButtonNode["variant"]>[] = [
  { value: "primary", label: "Primary" },
  { value: "secondary", label: "Secondary" },
  { value: "link", label: "Link" },
];

export const layoutOptions: readonly Option<RepeaterNode["layout"]>[] = [
  { value: "stack", label: "Stacked" },
  { value: "grid-2", label: "Grid · 2" },
  { value: "grid-3", label: "Grid · 3" },
  { value: "grid-4", label: "Grid · 4" },
];

export const headingLevelOptions = [
  { value: "1", label: "H1" },
  { value: "2", label: "H2" },
  { value: "3", label: "H3" },
  { value: "4", label: "H4" },
] as const;

/** Matches the schema's `SlotKey` pattern. */
export const slotKeyPattern = /^[a-z][A-Za-z0-9]{0,39}$/;

export const urlPattern = /^(https?:\/\/|mailto:|tel:)/;
