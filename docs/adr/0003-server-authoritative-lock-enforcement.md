# 0003 — Locking rules enforced on the server by diffing against the stored document

## Context

Designers lock content for compliance (disclosures, brand colours). The editor shows locks, but
any rule enforced only in the UI can be bypassed with a crafted request.

## Decision

The API is authoritative. Every site draft write runs, after schema validation:

| Rule | Check | Applies to |
|---|---|---|
| 1. Slot locks | No stored value for a locked slot (section values and repeater items). Locked slots always render the definition's default. | Sites **and** templates |
| 2. Section locks | Compared with the *stored* draft: `locked`/`required` instances still exist in the same region (header, footer, or page), are not hidden, keep their lock flag; `locked` instances are structurally unchanged and keep their order relative to other locked instances; new instances have `lock = none`. | Site owners |
| 3. Theme locks | `themeLocks` unchanged; values of locked tokens unchanged. | Site owners |
| 4. Versions | Existing instances keep their pinned `(sectionTypeId, version)`; new instances reference a published version of a non-archived type. | Sites and templates |

Violations are returned together as **422 ProblemDetails** with `errors: [{ code, path, message }]`
(JSON-pointer paths, stable codes). The rules are pure functions in `Strata.Domain`
(`SiteDocumentValidator`, `LockRules`) fed with preloaded context, so they are unit-tested
without a database and integration-tested by trying to bypass each one through the HTTP API.

### Interpretation: "locked sections cannot be moved"

Owners may insert, remove or reorder *other* sections around a locked one (otherwise a locked
section at the top of a page would block adding content above it). The locked section itself
cannot change page or region, cannot be hidden, and keeps its order relative to other locked
sections; the editor offers it no move controls. Pages containing locked or required sections
cannot be deleted (that would remove them).

## Consequences

- Chain of custody: a site's first draft is created by the server from a template version, and
  every later draft is diffed against the previous stored one, so lock flags can only originate
  from a designer.
- The editor mirrors the rules for UX but never replaces them.
- Rule 2 needs the previous document; rule 1 does not, so it also protects templates.
