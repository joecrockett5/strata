import type { ImageValue, SlotValue } from "@strata/schema";

export interface NavLink {
  pageId: string;
  title: string;
  href: string;
  current: boolean;
}

export interface SiteInfo {
  firmName: string;
  logo: ImageValue | null;
  homeHref: string;
  nav: NavLink[];
}

export type ContactField = "name" | "email" | "phone" | "message";

/** Server-side state of a contact form after a submission (published sites only). */
export type ContactFormState =
  | { sectionId: string; status: "success" }
  | {
      sectionId: string;
      status: "invalid";
      values: Partial<Record<ContactField, string>>;
      errors: Partial<Record<ContactField, string>>;
    };

/**
 * Everything a renderer needs beyond the content itself. Plain data (no callbacks) so the same
 * JSON drives the React and Razor renderers in parity tests.
 */
export interface RenderContext {
  site: SiteInfo;
  /** href for every page id that links may target. */
  pageHrefs: Record<string, string>;
  /** Prefix for media URLs, e.g. "/media/". */
  mediaBase: string;
  /** Where the contact form posts. */
  formAction: string;
  /** Id of the page being rendered (sent with contact submissions). */
  pageId: string;
  formState?: ContactFormState;
}

/** Slot values in scope: the section instance's own, or one repeater item's. */
export interface SlotScope {
  instanceId: string;
  values: Readonly<Record<string, SlotValue | undefined>>;
  repeaterKey?: string;
  itemId?: string;
}
