/* eslint-disable */
/**
 * GENERATED from schema/strata-content.schema.json — do not edit by hand.
 * Regenerate with `pnpm --filter @strata/schema gen`.
 */

/**
 * Single source of truth for Strata content: section definitions (trees of primitives with slots), slot values, themes, section instances and site documents. TypeScript types are generated from this file; the API validates every content write against it.
 */
export type StrataContent = SectionDefinition | SiteDocument;
/**
 * Stable id of a node within its section definition.
 */
export type NodeId = string;
/**
 * Colour token used as a section background. Text colour follows automatically (onPrimary on primary).
 */
export type SectionBackground = "background" | "surface" | "primary";
/**
 * camelCase key, unique within a section definition (including repeater keys).
 */
export type SlotKey = string;
export type SlotMode = "editable" | "locked";
export type Uuid = string;
/**
 * Step on the fixed spacing scale.
 */
export type Spacing = "none" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
export type ContentWidth = "narrow" | "standard" | "wide" | "full";
/**
 * Any primitive except the section root.
 */
export type ChildNode =
  | StackNode
  | ColumnsNode
  | HeadingNode
  | RichTextNode
  | ImageNode
  | ButtonNode
  | RepeaterNode
  | NavNode
  | ContactFormNode
  | SpacerNode
  | DividerNode;
/**
 * Relative column widths; the number of parts must equal the number of columns.
 */
export type ColumnRatio =
  "1" | "1:1" | "1:2" | "2:1" | "1:3" | "3:1" | "1:1:1" | "1:2:1" | "2:1:1" | "1:1:2" | "1:1:1:1";
export type Align = "start" | "center" | "end";
export type LinkTarget = PageLinkTarget | UrlLinkTarget;
/**
 * @maxItems 50
 */
export type Children = ChildNode[];
export type HexColor = string;
/**
 * Curated system font stacks (no web-font downloads).
 */
export type FontStack =
  "system-ui" | "neo-grotesque" | "humanist" | "geometric-humanist" | "transitional" | "old-style";
export type ThemeTokenPath =
  | "colors.primary"
  | "colors.onPrimary"
  | "colors.secondary"
  | "colors.accent"
  | "colors.background"
  | "colors.surface"
  | "colors.text"
  | "colors.mutedText"
  | "fonts.heading"
  | "fonts.body"
  | "radius";
/**
 * Set by designers in starter templates. locked: cannot be removed, moved or edited. required: cannot be removed.
 */
export type SectionLock = "none" | "required" | "locked";
export type SlotValue = TextValue | RichTextValue | ImageValue | LinkValue;

/**
 * A section type's tree of primitives. Published versions are immutable.
 */
export interface SectionDefinition {
  schemaVersion: 1;
  root: SectionNode;
}
/**
 * Root of every section definition.
 */
export interface SectionNode {
  $type: "section";
  id: NodeId;
  background: SectionBackground;
  backgroundImage?: ImageSlotDefinition;
  paddingY: Spacing;
  width: ContentWidth;
  children: Children;
}
export interface ImageSlotDefinition {
  key: SlotKey;
  label: string;
  type: "image";
  mode: SlotMode;
  required: boolean;
  default: ImageValue;
}
/**
 * A media reference plus alt text. Alt text is stored per use, not per media asset.
 */
export interface ImageValue {
  $type: "image";
  mediaId: Uuid | null;
  alt: string;
}
export interface StackNode {
  $type: "stack";
  id: NodeId;
  gap: Spacing;
  align: "start" | "center" | "end" | "stretch";
  children: Children;
}
export interface ColumnsNode {
  $type: "columns";
  id: NodeId;
  ratio: ColumnRatio;
  gap: Spacing;
  valign: "start" | "center" | "end" | "stretch";
  /**
   * Columns stack vertically below this breakpoint.
   */
  stackAt: "tablet" | "mobile";
  /**
   * @minItems 1
   * @maxItems 4
   */
  columns: [Column] | [Column, Column] | [Column, Column, Column] | [Column, Column, Column, Column];
}
export interface Column {
  children: Children;
}
export interface HeadingNode {
  $type: "heading";
  id: NodeId;
  level: number;
  align: Align;
  text: TextSlotDefinition;
}
export interface TextSlotDefinition {
  key: SlotKey;
  label: string;
  type: "text";
  mode: SlotMode;
  required: boolean;
  maxLength?: number;
  default: TextValue;
}
export interface TextValue {
  $type: "text";
  text: string;
}
export interface RichTextNode {
  $type: "richText";
  id: NodeId;
  align: Align;
  content: RichTextSlotDefinition;
}
export interface RichTextSlotDefinition {
  key: SlotKey;
  label: string;
  type: "richText";
  mode: SlotMode;
  required: boolean;
  /**
   * Maximum length of the visible text (tags excluded).
   */
  maxLength?: number;
  default: RichTextValue;
}
/**
 * HTML restricted to p, br, strong, em, a, ul, ol, li. Sanitised by the server on every write.
 */
export interface RichTextValue {
  $type: "richText";
  html: string;
}
export interface ImageNode {
  $type: "image";
  id: NodeId;
  aspect: "auto" | "1:1" | "4:3" | "3:2" | "16:9" | "3:4";
  fit: "cover" | "contain";
  /**
   * none, the theme's corner radius, or fully rounded (circle for 1:1).
   */
  radius: "none" | "theme" | "full";
  image: ImageSlotDefinition;
}
export interface ButtonNode {
  $type: "button";
  id: NodeId;
  variant: "primary" | "secondary" | "link";
  align: Align;
  label: TextSlotDefinition;
  link: LinkSlotDefinition;
}
export interface LinkSlotDefinition {
  key: SlotKey;
  label: string;
  type: "link";
  mode: SlotMode;
  required: boolean;
  default: LinkValue;
}
export interface LinkValue {
  $type: "link";
  target: LinkTarget | null;
}
export interface PageLinkTarget {
  kind: "page";
  pageId: Uuid;
}
/**
 * External link. Only http(s), mailto and tel URLs are allowed.
 */
export interface UrlLinkTarget {
  kind: "url";
  url: string;
}
/**
 * Repeats its children once per item. Slots inside are stored per item. Repeaters cannot be nested.
 */
export interface RepeaterNode {
  $type: "repeater";
  id: NodeId;
  key: SlotKey;
  itemLabel: string;
  min: number;
  max: number;
  defaultItemCount: number;
  layout: "stack" | "grid-2" | "grid-3" | "grid-4";
  gap: Spacing;
  children: Children;
}
/**
 * Logo and firm name from site settings plus links generated from the site's pages.
 */
export interface NavNode {
  $type: "nav";
  id: NodeId;
}
/**
 * Fixed fields: name, email, optional phone, message.
 */
export interface ContactFormNode {
  $type: "contactForm";
  id: NodeId;
  submitLabel: TextSlotDefinition;
  successMessage: TextSlotDefinition;
}
export interface SpacerNode {
  $type: "spacer";
  id: NodeId;
  size: Spacing;
}
export interface DividerNode {
  $type: "divider";
  id: NodeId;
}
/**
 * A whole site: settings, theme (with designer token locks), global header/footer and pages. Used for site drafts, starter templates and published snapshots.
 */
export interface SiteDocument {
  schemaVersion: 1;
  settings: SiteSettings;
  theme: Theme;
  themeLocks: ThemeTokenPath[];
  header: SectionInstance | null;
  footer: SectionInstance | null;
  /**
   * @minItems 1
   * @maxItems 30
   */
  pages: [Page, ...Page[]];
}
export interface SiteSettings {
  firmName: string;
  logo: ImageValue | null;
}
export interface Theme {
  colors: ThemeColors;
  fonts: ThemeFonts;
  radius: "none" | "small" | "large";
}
export interface ThemeColors {
  primary: HexColor;
  onPrimary: HexColor;
  secondary: HexColor;
  accent: HexColor;
  background: HexColor;
  surface: HexColor;
  text: HexColor;
  mutedText: HexColor;
}
export interface ThemeFonts {
  heading: FontStack;
  body: FontStack;
}
/**
 * Use of a section type on a page. Pins a published version and stores values for editable slots only.
 */
export interface SectionInstance {
  id: Uuid;
  sectionTypeId: Uuid;
  version: number;
  lock: SectionLock;
  hidden: boolean;
  values: {
    [k: string]: SlotValue | undefined;
  };
  repeaters: {
    /**
     * @maxItems 24
     */
    [k: string]: RepeaterItem[] | undefined;
  };
}
export interface RepeaterItem {
  id: Uuid;
  values: {
    [k: string]: SlotValue | undefined;
  };
}
/**
 * A page. The order of the pages array is the navigation order; the page with slug "" is the home page.
 */
export interface Page {
  id: Uuid;
  title: string;
  slug: string;
  showInNav: boolean;
  seo: PageSeo;
  /**
   * @maxItems 40
   */
  sections: SectionInstance[];
}
export interface PageSeo {
  title: string;
  description: string;
}
