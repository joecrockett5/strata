import { Badge } from "@/components/ui/badge";

/** Anything versioned by publishing immutable versions (section types, starter templates). */
export interface Versioned {
  archived: boolean;
  latestVersion: number;
  hasUnpublishedChanges: boolean;
}

/** Draft / Published / Unpublished changes / Archived. */
export function StatusBadges({ type }: { type: Versioned }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {type.archived ? <Badge>Archived</Badge> : null}
      {type.latestVersion > 0 ? <Badge tone="green">Published</Badge> : <Badge tone="amber">Draft</Badge>}
      {type.latestVersion > 0 && type.hasUnpublishedChanges ? (
        <Badge tone="blue">Unpublished changes</Badge>
      ) : null}
    </span>
  );
}
