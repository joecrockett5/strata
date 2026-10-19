# 0002 — One JSON Schema for the content model; content stored as `jsonb`

## Context

Section definitions are recursive trees of a dozen primitive types; site documents nest pages,
section instances, per-item repeater values and themes. The same shapes are produced by the React
editor, validated by the .NET API, rendered by two renderers, and snapshotted on publish. Three
hand-maintained copies of the model (TS, C#, database) would drift.

## Decision

1. **`schema/strata-content.schema.json` (JSON Schema 2020-12) is the single source of truth.**
   Polymorphic objects carry a `$type` discriminator (nodes, slot values) or `kind` (link targets).
2. **TypeScript types are generated** from it (`packages/schema`, json-schema-to-typescript). CI
   fails if the committed output is stale.
3. **C# records are hand-written** (`Strata.Domain.Content`) using System.Text.Json polymorphism,
   and are *checked* against the schema rather than generated: C# generators handle `$type`
   unions, records and enums poorly, and hand-written records give a far nicer domain model.
   Drift is caught by:
   - JSON Schema validation (JsonSchema.Net, schema embedded in the assembly) of **every** content
     write before deserialisation;
   - round-trip tests: shared fixtures (`fixtures/content`) → C# → JSON must be deep-equal to the
     input and still validate;
   - a test that the set of `$type` discriminators in the schema equals the set registered in C#;
   - the same fixtures validated with Ajv in the TS test suite.
4. **Storage**: relational tables hold identity, ownership, versions and relationships; content
   lives in `jsonb` columns mapped to the C# records through one value converter that uses the
   same serializer options as validation. A site draft is **one document** (all pages, header,
   footer, theme), with a single revision number used as the ETag.
5. In the OpenAPI document, content fields are opaque JSON (`JsonElement`); the editor types them
   with `@strata/schema` in one place instead of duplicating the content model through OpenAPI.

## Consequences

- One write pipeline: schema → deserialise → sanitise → semantic rules → lock rules → save.
- Errors in `oneOf` unions are narrowed to the branch chosen by the discriminator, so a typo
  inside a heading reports `/root/children/3/level`, not eleven unrelated branch failures.
- Whole-document drafts make undo/redo, autosave, optimistic concurrency, lock diffing,
  template copying and publish snapshots trivial. Trade-off: concurrent edits of *different*
  pages of one site conflict (409). Acceptable without real-time collaboration (out of scope);
  per-page rows could be introduced later behind the same document API.
- Referential integrity between instances and section versions is enforced in code on every
  write rather than with foreign keys; published versions are immutable, so a valid reference
  stays valid.
- System.Text.Json only writes a discriminator when the declared type is the polymorphic base.
  Content records declare concrete subtypes for strong typing, so `ContentJson` includes a
  contract modifier that routes such properties through their base type. The round-trip test
  exists precisely because this kind of mismatch is otherwise invisible.
