# 0004 — Sites are independent copies; section instances pin immutable versions

## Context

Designers keep improving section types and templates. Site owners must never see their
published site change because someone else edited a shared definition, and compliance reviewers
need to know exactly what was published.

## Decision

- Publishing a section type or template **freezes** the draft as version N in an immutable row
  (`section_type_versions`, `starter_template_versions`). Drafts continue separately.
- A **section instance pins** `(sectionTypeId, version)`. The library inserts the latest
  published version; existing instances are never re-pointed (the API rejects attempts).
- **Creating a site copies** the latest published template version's document. The site records
  `source_template_id` and `source_template_version`; later template versions never propagate.
- A **published site version** snapshots the whole draft *plus* every section definition it
  uses, so public pages render from one row with no further lookups.

## Consequences

- Upgrading instances to newer section versions is out of scope, but the stored pins and
  immutable versions are exactly what an upgrade-with-slot-mapping feature would need.
- Archiving a section type hides it from the library without breaking existing uses.
- Snapshots duplicate definitions (small JSON) in exchange for self-contained, cacheable public
  rendering and an exact audit record of what went live.
