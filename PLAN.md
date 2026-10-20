# Strata — Plan

Strata is a section-based website builder. Designers compose **section types** from
**primitives** and assemble **starter templates**; site owners create sites from templates,
edit them inline in a drag-and-drop editor, and publish server-rendered public sites.

This document is the living architecture plan. The brief (in the initial project prompt) is the
source of truth for requirements; this file records *how* they are met and the decisions taken.
ADRs in `docs/adr/` record the most important decisions in more depth.

---

## 1. Architecture overview

```
                    ┌──────────────────────── browser ────────────────────────┐
                    │  apps/editor (Vite + React)                             │
                    │   ├─ designer: section library, section designer        │
                    │   ├─ designer: starter templates (uses site editor)     │
                    │   └─ owner: sites, site editor, media, submissions      │
                    │        └─ canvas = same-origin <iframe> + React portal  │
                    │             └─ packages/renderer (+ editing adapter)    │
                    │                  └─ packages/site-styles (site.css)     │
                    └───────────────┬─────────────────────────────────────────┘
                                    │ same origin (Vite proxy in dev / nginx in compose)
                    ┌───────────────▼─────────────────────────────────────────┐
                    │  Strata.Api (ASP.NET Core minimal APIs)                 │
                    │   /api/*   JSON API, cookie auth + antiforgery          │
                    │   /media/* uploaded files                               │
                    │   /site-assets/* site.css, site.js (from site-styles)   │
                    │   /s/{slug}/* and {slug}.localhost → public sites       │
                    ├─────────────────────────────────────────────────────────┤
                    │  Strata.Rendering  (Razor components → static HTML)     │
                    │  Strata.Infrastructure (EF Core, Identity, storage,     │
                    │                         sanitiser, JSON-Schema checks)  │
                    │  Strata.Domain (content model, validation, lock rules,  │
                    │                 publish checks, contrast)               │
                    └───────────────┬─────────────────────────────────────────┘
                                    │
                              PostgreSQL 17 (relational + jsonb)
```

### Project layout

```
/schema/                         JSON Schema — single source of truth for content
  strata-content.schema.json
/fixtures/parity/                parity inputs (*.json) and React output (*.expected.html)
/fixtures/contrast.json          shared WCAG contrast test vectors (TS + .NET)
/src/
  Strata.Domain/                 content model records, validation, locking, publish checks
  Strata.Infrastructure/         EF Core DbContext + migrations, Identity, IFileStorage,
                                 HtmlSanitizer, JSON Schema validator, seeding
  Strata.Rendering/              Razor components + HtmlRenderer-based renderer library
  Strata.Api/                    endpoints (feature folders), auth, public site hosting
/tests/
  Strata.Domain.Tests/           unit tests for validation, locks, publish checks
  Strata.Rendering.Tests/        Razor renderer + parity tests
  Strata.Api.Tests/              integration tests (WebApplicationFactory + Testcontainers)
/apps/editor/                    Vite + React editor app (designer + owner)
/packages/
  schema/                        generated TS types + content helpers
  renderer/                      React renderer (no editor dependencies)
  site-styles/                   hand-written published-site CSS (+ tiny site.js)
  api-client/                    openapi-typescript types + openapi-fetch client
/e2e/                            Playwright tests (milestone acceptance tests)
/scripts/                        dev/test/e2e scripts (the Makefile delegates to these)
/docs/adr/                       architecture decision records
```

Dependency direction (.NET): `Api → Rendering → Domain`, `Api → Infrastructure → Domain`.
Domain has no infrastructure dependencies. Rendering depends only on Domain.

Dependency direction (TS): `editor → renderer → schema`, `editor → api-client`,
`renderer` has **no** editor dependencies (no Zustand, dnd-kit, TipTap, Tailwind).

---

## 2. Content model

One JSON Schema (`/schema/strata-content.schema.json`, draft 2020-12) defines:
`SectionDefinition`, the node union (primitives), `SlotDefinition`, slot values, `Theme`,
`SectionInstance`, `Page`, `SiteDocument`.

* **TypeScript**: types generated from the schema with `json-schema-to-typescript` into
  `packages/schema/src/generated.ts`. CI fails if the generated file is stale.
* **.NET**: hand-written C# records in `Strata.Domain.Content` using System.Text.Json
  polymorphism (`$type`). Every content write is validated against the JSON Schema
  (JsonSchema.Net) *before* deserialisation, then semantically validated in C#.
  Drift between C# and the schema is caught by tests: every fixture round-trips through C#
  and re-validates against the schema; the set of `$type` discriminators in the schema must
  equal the set registered in C#. (ADR 0002.)

### Nodes (primitives)

Every node has `$type` and a stable `id` (string, unique in the section; used for editor
selection and as an anchor). Style properties are enum tokens/presets only.

| `$type` | Properties | Slots |
|---|---|---|
| `section` (root only) | `background` (`background`/`surface`/`primary`), `paddingY` (spacing), `width` (`narrow`/`standard`/`wide`/`full`), `children` | `backgroundImage?` (image) |
| `stack` | `gap`, `align` (`start`/`center`/`end`/`stretch`), `children` | — |
| `columns` | `ratio` (preset valid for the column count), `gap`, `valign`, `stackAt` (`tablet`/`mobile`), `columns: [{ children }]` (1–4) | — |
| `heading` | `level` (1–4), `align` | `text` (text) |
| `richText` | `align` | `content` (richText) |
| `image` | `aspect` (`auto`/`1:1`/`4:3`/`3:2`/`16:9`/`3:4`), `fit` (`cover`/`contain`), `radius` (`none`/`theme`/`full`) | `image` (image) |
| `button` | `variant` (`primary`/`secondary`/`link`), `align` | `label` (text), `link` (link) |
| `repeater` | `key`, `itemLabel`, `min`, `max`, `defaultItemCount`, `layout` (`stack`/`grid-2`/`grid-3`/`grid-4`), `gap`, `children` (item template) | per item: slots inside `children` |
| `nav` | `showLogo`, `showFirmName` | — (data from site settings + pages) |
| `contactForm` | — | `submitLabel` (text), `successMessage` (text) |
| `spacer` | `size` (spacing) | — |
| `divider` | — | — |

Rules (checked when validating a definition; the stricter set also before *publishing a version*):
unique node ids; slot keys unique across the whole section (including inside repeaters, so
values never collide); repeater keys unique and distinct from slot keys; repeater `min ≤
defaultItemCount ≤ max`; no repeater inside a repeater (keeps the value model flat: one level
of items — sufficient for every section in the brief; noted as a limitation); at most one `nav`
and one `contactForm` (neither inside a repeater);
every image slot has default alt text or is `required`; `section` only as root.

### Slots and values

```jsonc
// SlotDefinition (embedded on the node that owns it)
{ "key": "headline", "label": "Headline", "type": "text",
  "mode": "editable" | "locked", "required": true, "maxLength": 80,
  "default": { "$type": "text", "text": "Plan with confidence" } }

// Slot values are tagged so the schema can validate them without the definition:
{ "$type": "text", "text": "…" }
{ "$type": "richText", "html": "<p>…</p>" }                 // sanitised server-side
{ "$type": "image", "mediaId": "uuid" | null, "alt": "…" }   // alt is per use
{ "$type": "link", "target": { "kind": "page", "pageId": "…" } | { "kind": "url", "url": "…" } | null }
```

### Section instance, page, site document

```jsonc
// SectionInstance
{ "id": "uuid", "sectionTypeId": "uuid", "version": 3,
  "lock": "none" | "required" | "locked",       // set by designers in templates only
  "hidden": false,
  "values":    { "<slotKey>": SlotValue },       // editable slots only
  "repeaters": { "<repeaterKey>": [ { "id": "uuid", "values": { … } } ] } }

// SiteDocument — used for site drafts, template drafts/versions and published snapshots
{ "schemaVersion": 1,
  "settings": { "firmName": "…", "logo": ImageValue | null },
  "theme": Theme,
  "themeLocks": ["colors.primary", "colors.secondary"],   // token paths
  "header": SectionInstance | null,                       // global, shared by all pages
  "footer": SectionInstance | null,
  "pages": [ { "id": "uuid", "title": "Home", "slug": "", "showInNav": true,
               "seo": { "title": "…", "description": "…" },
               "sections": [SectionInstance] } ] }
```

* The **array order of `pages` is the nav order** (one source of truth instead of a separate
  `navOrder` integer that could disagree with it). The home page is the page with slug `""`;
  exactly one must exist. Slugs are flat, lower-case kebab-case, and unique.
* Missing values render the slot default. Missing repeater arrays render `defaultItemCount`
  default items. Locked slots always render the designer's default (rule 1).

### Theme

```jsonc
{ "colors": { "primary", "onPrimary", "secondary", "accent", "background", "surface", "text", "mutedText" },  // #rrggbb
  "fonts":  { "heading": FontStackId, "body": FontStackId },  // 6 curated system font stacks
  "radius": "none" | "small" | "large" }
```

Tokens become CSS custom properties (`--st-color-primary`, `--st-font-heading`,
`--st-radius`, …) on the `.st-site` root. The spacing scale (`none|xs|sm|md|lg|xl|2xl`) is fixed
in `site.css`. Font stacks are system stacks (no web-font downloads, no third-party hosts).

---

## 3. Data model (PostgreSQL)

Relational tables hold identity, ownership, versions and relationships; content is `jsonb`.

| Table | Key columns |
|---|---|
| Identity tables | `AspNetUsers` (Guid keys), roles `Designer`, `SiteOwner` |
| `section_types` | id, name, category, archived_at, draft_definition **jsonb**, draft_revision, latest_version, created_by, timestamps |
| `section_type_versions` | (section_type_id, version) PK, definition **jsonb**, published_at, published_by — immutable |
| `starter_templates` | id, name, description, thumbnail_media_id, archived_at, draft_document **jsonb**, draft_revision, latest_version, timestamps |
| `starter_template_versions` | (template_id, version) PK, document **jsonb**, name/description snapshot, published_at — immutable |
| `theme_presets` | id, name, theme **jsonb** |
| `sites` | id, owner_id (FK users), name, slug (unique), draft_document **jsonb**, draft_revision, source_template_id, source_template_version, current_published_version_id, timestamps |
| `published_site_versions` | id, site_id, version_number, snapshot **jsonb** (document + resolved section definitions), source_draft_revision, published_at — immutable |
| `media_assets` | id, owner_id, original_file_name, content_type, byte_size, width, height, storage_key, created_at |
| `contact_submissions` | id, site_id, published_version_id, section_instance_id, name, email, phone, message, created_at |

* Whole-site draft as **one jsonb document** per site (pages included). Undo/redo, autosave,
  optimistic concurrency, lock-diffing, template copying and publishing all operate on one
  document with one revision number. Trade-off: concurrent edits of *different* pages conflict
  (acceptable — real-time collaboration is out of scope). See ADR 0002.
* `draft_revision` (bigint) is the optimistic-concurrency token, exposed as a strong ETag;
  writes require `If-Match` and return 409 on mismatch, 428 when the header is missing.
* Published snapshots embed the exact section definitions they use (`"typeId@version" →
  definition`), so a public page renders from a single row with no further lookups.
* Section instances pin `(sectionTypeId, version)`. Versions are immutable rows; storing the
  pinned version is enough to add instance upgrades later (ADR 0004).

---

## 4. API surface

All JSON endpoints under `/api`, cookie-authenticated, antiforgery-protected for unsafe methods
(`X-XSRF-TOKEN` header, double-submit cookie issued by `GET /api/auth/antiforgery`). Errors are
RFC 9457 ProblemDetails; content-validation failures are **422** with an `errors` array of
`{ code, path, message }`.

| Area | Endpoints | Roles |
|---|---|---|
| Auth | `GET /api/auth/antiforgery`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` | anon / any |
| Section types | `GET /api/section-types`, `POST /api/section-types`, `GET/PUT /api/section-types/{id}` (draft, `If-Match`), `POST …/{id}/duplicate`, `POST …/{id}/archive`, `POST …/{id}/restore`, `POST …/{id}/versions` (publish), `GET …/{id}/versions/{v}` | Designer |
| Library | `GET /api/library` (latest published, non-archived), `GET /api/section-definitions?refs=id@v,…` | Designer, SiteOwner |
| Theme presets | `GET /api/theme-presets`, `POST`, `PUT/DELETE /api/theme-presets/{id}` | read: any; write: Designer |
| Templates | `GET /api/templates`, `POST`, `GET/PUT /api/templates/{id}` (draft, `If-Match`), `POST …/{id}/versions`, `POST …/{id}/archive` | Designer (owners: `GET /api/templates/published`) |
| Sites | `GET /api/sites`, `POST /api/sites` (from template version or blank), `GET /api/sites/{id}`, `PATCH /api/sites/{id}` (name, slug), `PUT /api/sites/{id}/draft` (`If-Match`), `DELETE /api/sites/{id}`, `POST …/{id}/publish-checks`, `POST …/{id}/publish`, `GET …/{id}/submissions` | SiteOwner (own sites only — others get 404) |
| Media | `POST /api/media` (multipart), `GET /api/media` | any authenticated |
| Files | `GET /media/{id}` | public (unguessable id; needed by public sites) |
| Public | `GET /s/{siteSlug}/{*pagePath}`, `/s/{siteSlug}/sitemap.xml`, `/s/{siteSlug}/robots.txt`, `POST /s/{siteSlug}/_contact`; the same on `{siteSlug}.localhost:{port}` | anon |
| Ops | `GET /health` (DB check), `GET /openapi/v1.json` | anon |

Cross-user access to a site returns **404** (not 403) so site ids cannot be probed.

---

## 5. Validation and locking pipeline (server-authoritative)

Every content write (`PUT …/draft` for section types, templates and sites):

1. **JSON Schema** validation of the raw body → 422 on failure.
2. Deserialise into C# records.
3. **Semantic validation** (`Strata.Domain`): section definitions exist/are published for
   pinned versions; values match slot types; `maxLength`; repeater item counts; unique
   ids/slugs; exactly one home page; media references are owned by the caller or by a designer.
4. **Lock rules** (`LockRuleValidator`, against the definitions and, for owners, the *stored*
   previous draft):
   1. *Slot locks*: values for locked slots → violation (sites **and** templates).
   2. *Section locks*: for every stored instance with `lock ≠ none`, it must still exist in the
      same region/page with the same lock flag and must not be hidden; `locked` instances
      must be byte-for-byte unchanged (values, repeaters, version) and keep their relative
      order among locked instances on the page. New instances must have `lock = none`; lock
      flags of existing instances cannot change. (Owners only — designers set these flags.)
   3. *Theme locks*: `themeLocks` unchanged; locked token values unchanged (owners only).
   4. *Versions*: an existing instance must keep its pinned `(sectionTypeId, version)`;
      a new instance must pin a published version of a non-archived section type.
5. Rich text is **sanitised** (HtmlSanitizer allowlist: `p, br, strong, em, a, ul, ol, li`;
   `href` schemes `http`, `https`, `mailto`, `tel`) and the sanitised document is stored.
6. Save with revision check (`If-Match`), bump revision.

The editor mirrors rules 1–3 in the UI (read-only locked slots with lock indicator, disabled
toolbar actions, disabled theme tokens) but the server never trusts it. Integration tests
attempt to bypass every rule directly through the API.

**Interpretation note — "locked sections cannot be moved".** Sections may be inserted around
a locked section (otherwise a locked section at the top of a page would block adding anything
above it), but the locked section itself has no move controls, cannot change page/region and
cannot be reordered relative to other locked sections. Required/locked sections cannot be
hidden (hiding is removal from the public site). Pages containing them cannot be deleted.

---

## 6. Rendering and parity

* **Razor renderer** (`Strata.Rendering`): Razor *components* rendered to static HTML with
  `HtmlRenderer` (no Blazor runtime on the page). A component per primitive mirrors a React
  component per primitive in `packages/renderer`. Both emit identical markup/class names
  (BEM-style `st-` prefix, e.g. `st-columns st-columns--ratio-1-2 st-columns--stack-tablet`).
* **Stylesheet**: `packages/site-styles/src/site.css`, hand-written, mobile-first, served by
  the API at `/site-assets/site.css` and injected into the editor canvas iframe.
* **Editing adapter**: optional React context. Without it, `renderer` emits exactly the
  published markup. With it, slots are wrapped by inline editors and nodes get
  `data-st-*` attributes for selection.
* **Parity**: `fixtures/parity/*.json` → `pnpm parity:generate` writes `*.expected.html`
  using React `renderToStaticMarkup`. `Strata.Rendering.Tests` renders the same inputs with
  Razor and compares after normalisation (AngleSharp parse; whitespace collapsed; attributes
  and inline style declarations sorted). A Vitest test asserts that React output still
  equals the committed `*.expected.html`, so snapshot changes are deliberate.
* **Canvas**: editor renders the page into a same-origin `<iframe>` via `createPortal` into
  `iframe.contentDocument.body`. The iframe is **auto-height** (no internal scroll), so the
  parent scroll container scrolls both the iframe and an absolutely positioned **overlay**
  layer that hosts section outlines, toolbars and drag handles (editor CSS, Tailwind).
  Because all drag sources (library cards, section handles) and drop targets (overlay boxes
  aligned to section rects measured from the iframe) live in the parent document, dnd-kit
  works without cross-document pointer tracking. Inline editors (contentEditable / TipTap)
  live inside the iframe through the adapter. Consequence: site CSS must avoid `vh` units
  (an auto-height iframe would feed back on itself) — documented in CLAUDE.md.
* Device preview sets the iframe width to 375 / 768 / 1280 px; media queries inside the
  iframe respond to its width.

---

## 7. Frontend architecture

* **Routing**: React Router. `/login`, `/designer/sections`, `/designer/sections/:id`,
  `/designer/templates`, `/designer/templates/:id`, `/sites`, `/sites/new`, `/sites/:id`.
* **Server state**: TanStack Query over the generated `openapi-fetch` client (antiforgery
  header and ProblemDetails handling in one middleware).
* **Document state**: one generic Zustand + Immer store (`createDocumentStore<T>`), used for
  section definitions (M3) and site/template documents (M4). UI state such as selection stays out
  of it, so undo never changes what is selected.
  Undo/redo via Immer patches (`produceWithPatches`); consecutive keystrokes in one slot are
  coalesced into a single history entry.
* **Autosave**: debounced (800 ms) `PUT` with `If-Match`; status indicator (saved / saving /
  error); 409 → blocking "changed elsewhere — reload" dialog; 422 → issues surfaced.
* **DnD**: dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`). Outline/layers panel offers the
  same moves via buttons and keyboard (accessible fallback). Every input method calls the same
  commands, which apply the same placement rules (`tree.ts` `canPlace`).
* **Rich text**: TipTap with StarterKit features disabled except bold, italic, lists, plus Link.
* **UI chrome**: Tailwind CSS + a small set of shadcn/ui-style components (Radix primitives).

---

## 8. Security

* ASP.NET Core Identity, cookie auth (`HttpOnly`, `SameSite=Lax`, `Secure` outside dev), API
  returns 401/403 instead of redirects. Antiforgery on all unsafe `/api` requests including
  login. Authorization policies per role; ownership checks via a site-access service used by
  every site endpoint.
* Uploads: JPEG/PNG/WebP by **magic bytes** (+ header parse for dimensions), ≤ 5 MB, SVG
  rejected; stored under random keys outside the web root via `IFileStorage`; served with
  `X-Content-Type-Options: nosniff` and the sniffed content type.
* Rich text sanitised on write (allowlist above). Public pages send a CSP.
* Contact form: server-side validation, `RateLimiter` fixed-window per IP + site, honeypot
  field. No antiforgery on the anonymous public form (no session to ride — CSRF is not a
  meaningful threat there, and per-request tokens would defeat page caching). Submission
  contents are never logged.
* Seeded passwords live in `appsettings.Development.json` (dev only) and the README.

---

## 9. Testing strategy

| Layer | Tooling | What |
|---|---|---|
| Domain | xUnit | schema/semantic validation, lock rules, publish checks, contrast |
| Rendering | xUnit + AngleSharp | Razor output, parity against React fixtures |
| API | xUnit + WebApplicationFactory + Testcontainers (Postgres) | auth, CRUD, versioning, ownership, every lock rule bypass attempt, uploads, publishing, public routing |
| Frontend unit | Vitest + Testing Library | renderer parity snapshots, stores (undo/redo), contrast, helpers |
| E2E | Playwright (Chromium) | milestone acceptance flows + README screenshots |

---

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| dnd-kit across an iframe boundary | Overlay-in-parent design (§6): no drag events cross documents. The section designer (M3) avoids it entirely by dragging into the outline; the site editor's overlay is the M4 spike. |
| React/Razor markup drift | Parity fixtures for every primitive; tiny shared vocabulary of class names; renderer components written side by side. |
| C# model drifting from JSON Schema | Schema validation on every write + discriminator-set and round-trip tests. |
| Nested DnD in the designer tree is fiddly | Outline panel with buttons/keyboard is first-class, DnD is an enhancement. |
| Rich text sanitiser output differing from TipTap output | Sanitise-and-store (never reject on cosmetic differences); renderers inject stored HTML verbatim. |
| Single-document drafts grow large | Documents are tens of KB for realistic sites; revisit with per-page rows if needed. |
| No local `make` in the dev environment | All logic lives in `scripts/*.sh`; the Makefile is a thin wrapper. |

---

## 11. Concerns about fixed decisions (implemented as specified)

1. **Two renderers** double the rendering work and need constant parity discipline. The parity
   suite is the mitigation; the alternative (Node SSR of the React renderer from .NET) would
   add a runtime dependency to public hosting. Kept as specified.
2. **Hand-written C# + generated TS from one schema** is "one source of truth" for TS, while
   C# is checked against it rather than generated (C# generators handle `$type`
   polymorphism and records poorly). ADR 0002 explains.
3. **Generated OpenAPI client vs schema types**: content documents travel as JSON validated
   against the content schema, so in OpenAPI they appear as opaque objects; the editor types
   them with `@strata/schema` in one wrapper module rather than duplicating the content model
   through OpenAPI.

---

## 12. Milestone status

See `PROGRESS.md`.
