import { versionKey } from "@strata/schema";
import type { PublishedSection } from "./siteModel";

/**
 * Section definitions the editor can render, by `typeId@version`. Commands read it synchronously
 * (a section inserted from the library is renderable in the same change); components subscribe.
 */
export class SectionRegistry {
  private sections: ReadonlyMap<string, PublishedSection>;
  private readonly listeners = new Set<() => void>();

  constructor(initial: readonly PublishedSection[]) {
    this.sections = new Map(initial.map((s) => [versionKey(s), s]));
  }

  readonly snapshot = (): ReadonlyMap<string, PublishedSection> => this.sections;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly register = (section: PublishedSection): void => {
    const key = versionKey(section);
    if (this.sections.get(key) === section) return;
    this.sections = new Map(this.sections).set(key, section);
    for (const listener of this.listeners) listener();
  };
}
