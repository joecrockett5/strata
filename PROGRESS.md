# Progress

## Environment notes

- The machine had no .NET SDK, Node or `make`, and no passwordless sudo. Installed user-locally:
  .NET SDK 10.0.402 (`~/.dotnet`, via dotnet-install.sh), Node 24.22.0 (`~/.local/node`), pnpm via
  corepack, Playwright Chromium (`~/.cache/ms-playwright`). PATH lines were appended to `~/.bashrc`
  and mirrored in `~/.strata-env` for non-interactive shells.
- `make` is unavailable, so all logic lives in `scripts/*.sh`; the `Makefile` is a thin wrapper
  (`make dev` ≡ `./scripts/dev.sh`, etc.).
- Docker 29 + Compose 5 are available and used for Postgres (dev), Testcontainers (tests) and the
  full stack.

---

## M0 — Plan and scaffold ✅

### Built
- `PLAN.md` (architecture, layout, data model, API surface, risks, concerns), `CLAUDE.md`.
- .NET 10 solution (`Strata.slnx`): Domain, Infrastructure, Rendering, Api, Api.Tests; central
  package management; nullable + warnings-as-errors + analyzers (`latest-recommended`).
- ASP.NET Core Identity (Guid keys) with cookie auth returning 401/403 (no redirects), role
  policies, antiforgery (double-submit `XSRF-TOKEN` cookie → `X-XSRF-TOKEN` header) enforced by
  middleware on every unsafe `/api` request including login. ProblemDetails for errors.
- EF Core + Npgsql with snake_case naming, initial migration; `DatabaseInitializer` migrates
  and seeds roles plus the two development users from `Seed` config (logs role only).
- `/health` (EF DbContext check), built-in OpenAPI at `/openapi/v1.json`; the document is also
  generated at build time into `packages/api-client/openapi/strata-api.json`.
- pnpm workspace: `apps/editor` (Vite 8, React 19, TS 5.9 strict, Tailwind 4, React Router,
  TanStack Query, login + role-aware shell), `packages/api-client` (openapi-typescript +
  openapi-fetch with antiforgery and ProblemDetails middleware), `e2e` (Playwright).
- Docker Compose (db, api, web = nginx serving the SPA and proxying the API same-origin, plus
  `*.localhost` host routing to the API), `scripts/{dev,test,e2e}.sh`, Makefile, GitHub Actions
  CI (backend, frontend, e2e jobs).

### Verification
| Criterion | How verified |
|---|---|
| `make dev` runs | `./scripts/dev.sh` started db + `dotnet watch` + vite; `/health` via the Vite proxy returned `Healthy`, editor served (manual smoke run, then stopped). |
| Both users can log in | `Strata.Api.Tests/Auth/AuthTests` (Testcontainers Postgres): both seeded roles log in and read `/me`; wrong password → 401 ProblemDetails; missing antiforgery → 400; logout; `/me` requires auth; health. Playwright `e2e/tests/m0-login.spec.ts`: designer and owner log in through the UI and land on role pages; sign-out; wrong-password error. |
| CI passes | GitHub Actions cannot run locally (no remote yet). Every command in `ci.yml` was run locally and is green: `dotnet build` (0 warnings), `dotnet test` (7/7), `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `./scripts/e2e.sh` (3/3). |
| Docker stack | `docker compose up --build -d --wait` → all three services healthy; owner logged in through nginx on :8080. |

### Deviations
- `make` replaced by scripts (see Environment notes). The Makefile still exists for machines that have make.
- TypeScript pinned to 5.9 (not 7.x): typescript-eslint and openapi-typescript do not support TS 7 yet.
- `packages/schema`, `packages/renderer` and `packages/site-styles` are created in M1/M2 with real content rather than as empty stubs.

### Known issues
- CI has not been executed on GitHub (no remote configured).

---

## M1 — Content model and API ✅

### Built
- **Content schema** `schema/strata-content.schema.json` (2020-12): primitives, slot definitions,
  tagged slot values, theme + token locks, section instances, pages, site documents.
  TS types generated into `packages/schema/src/generated.ts` (+ helpers: `slotCatalog`,
  `walkDefinition`, `effectiveValue`, …). Shared fixtures in `fixtures/content/`.
- **C# content model** (`Strata.Domain.Content`) with `$type` polymorphism and a contract modifier
  so discriminators are written even for concretely-typed properties (ADR 0002).
- **Rules** (pure, in Domain): `SectionDefinitionRules` (pre-publish: unique keys/ids, repeater
  bounds, ≤1 nav, image alt-or-required, no nested repeaters/sections, ratio vs column count,
  defaults within maxLength, no page links in defaults), `SiteDocumentValidator` (slot locks,
  types, maxLength, repeater counts, media ownership, unique ids/slugs, one home page),
  `LockRules` (section locks, theme locks, version pins). ADR 0003.
- **Infrastructure**: EF Core entities + migration (`section_types`, `section_type_versions`,
  `starter_templates`, `starter_template_versions`, `theme_presets`, `sites`,
  `published_site_versions`, `media_assets`) with typed `jsonb` columns; embedded-schema
  validator (JsonSchema.Net) with discriminator-aware error narrowing; HtmlSanitizer allowlist;
  `IFileStorage` (local disk); magic-byte image inspection (JPEG/PNG/WebP + dimensions; SVG and
  everything else rejected); dependency-free PNG encoder (seed/test images).
- **API**: section types (CRUD, duplicate, archive/restore, versions), library, theme presets,
  templates (CRUD, versions, published list for owners), sites (create blank/from template,
  get, rename, draft save with `If-Match`, delete), media (upload, list, public serve). One
  `ContentWritePipeline` for every content write. 422 ProblemDetails with `errors[]`;
  409/428 for concurrency; 404 for other owners' sites.
- OpenAPI regenerated; TS client regenerated. ADRs 0002–0004.

### Verification
| Criterion | Test |
|---|---|
| CRUD | `SectionTypeApiTests`, `TemplateApiTests`, `SiteApiTests` (create/read/update/delete, slug validation/uniqueness, duplicate, archive/restore, theme presets) |
| Versioning | publish → v1, v2; v1 definition unchanged after v2; drafts with rule violations save but cannot publish (422 lists codes); library shows latest published, hides draft-only/archived; site from template keeps pinned v1 after section v2 + template v2 (`Site_from_a_template_is_an_independent_copy_pinned_to_its_versions`) |
| Ownership | `Owners_only_see_and_touch_their_own_sites` (GET/PUT/PATCH/DELETE → 404, list excludes), role checks (owner → 403 on designer endpoints, designer → 403 on sites), anonymous → 401, antiforgery required, cross-owner media reference rejected |
| Every locking rule (API bypass attempts) | `LockingRulesApiTests`: rule 1 (owner + designer/template), rule 2 (remove locked, remove locked footer, edit locked, move locked to another page, hide locked, remove required, remove required header, delete page with required section, unlock, add with lock flag), rule 3 (change locked token → path `/theme/colors/secondary`, drop theme locks), rule 4 (re-pin existing, unpublished version, archived type: new rejected, existing kept); plus the allowed-edits happy path |
| Schema validation on every write | schema-invalid definitions/documents/themes → 422 with JSON-pointer paths |
| Security | rich text sanitised on write (`Rich_text_is_sanitised_on_write`), uploads sniffed by bytes (SVG/renamed files → 415, > 5 MB → 413), `nosniff` on served files |
| Unit level | Domain.Tests (40: definition rules, document validator, lock rules), Infrastructure.Tests (33: schema/C# round trips and discriminator parity, validator error narrowing, sanitiser allowlist + idempotence, image inspector); `@strata/schema` Vitest (Ajv validates the same fixtures) |

Totals: 134 .NET tests green (Api 61 incl. M0, Domain 40, Infrastructure 33); API suite run
4× consecutively without failures. A quick mutation check (disabling the slot-lock rule) made
the relevant tests fail as expected.

### Deviations / decisions
- **Pages are edited through the site document** (`PUT /api/sites/{id}/draft`), not separate
  page endpoints — one revision for the whole draft (ADR 0002). Nav order = order of `pages`.
- Section background tokens are limited to `background`, `surface`, `primary` (text colour is
  derived: `onPrimary` on `primary`) so every background has a defined, contrast-checkable text colour.
- Repeaters cannot nest; at most one contact form per section and none inside repeaters.
- Section-definition rules block *publishing a version*, not saving a draft (drafts report issues).
- Server accepts any published version of a non-archived type for new instances; "latest" is
  what the library offers (enforcing "latest only" would 422 autosaves that race a designer publish).
- Media: owners may reference their own uploads and designer uploads (used by templates).

### Known issues
- ASP.NET Core Identity: after a failed login, the next successful login resets the failure
  counter with a concurrency-stamped update; simultaneous logins of the same account at that
  moment can fail one of them. Tests use a dedicated account for failed-login probes.

---

## M2 — Renderers ✅

### Built
- `packages/site-styles`: hand-written mobile-first `site.css` (tokens → `--st-*` custom
  properties, font stacks and radius as classes, columns/repeater grids with tablet/mobile
  stacking, nav with JS-enhanced mobile menu, form states, focus styles, no `vh` units) and a
  10-line `site.js` (progressive enhancement). Served by the API at `/site-assets/`.
- `packages/renderer` (React, no editor deps): `SiteRoot`, `SectionView`, `PageView`, a component
  per primitive, data-only `RenderContext`, `buildSiteInfo`/`pageHrefs` helpers, and the optional
  `EditingAdapter` (text, richText, image, button, repeaterItem, afterRepeater, decorateNode,
  decorateSection hooks).
- `Strata.Rendering` (Razor components via `HtmlRenderer`): mirrors every component; `Css` and
  `RenderRules` mirror `classes.ts`/`model.ts`; `StrataRenderer.RenderSectionAsync/RenderPageAsync`.
- Parity harness: 10 fixtures in `fixtures/parity` (every primitive; Columns inside a Repeater;
  default repeater items; images with all aspect/fit/radius; button link kinds incl. broken page
  links; nav with/without logo; contact form default/success/invalid; all column counts/ratios;
  a full page with header, hidden section and locked footer; two themes).
- ADR 0001.

### Verification
| Criterion | How |
|---|---|
| Parity for every primitive, incl. Columns in Repeater | `Strata.Rendering.Tests.ParityTests` — 10/10 fixtures equal after normalisation; `Fixtures_cover_every_primitive` asserts all 12 `$type`s appear. Sensitivity checked by changing one class name in a Razor component (3 fixtures failed, then restored). |
| React snapshots stable | `@strata/renderer` Vitest: snapshot equality for all fixtures + fixtures validate against the content schema (Ajv) |
| Adapter contract | Vitest: an empty adapter yields byte-identical output for every fixture; hooks receive correct slot targets (incl. repeater item ids) and can decorate nodes/sections/items |
| Normaliser | `NormalizerTests` pin what is forgiven (attribute/class/style order, entity forms, formatting whitespace, boolean attribute forms) and what is not (tags, attribute values, class sets, text, nesting) |
| Theme tokens → CSS variables; responsive behaviour | Screenshots of 7 fixtures at 375/768/1280 px with `site.css` inspected: repeater grid 3→1 columns, Columns side-by-side→stacked by breakpoint, nav current-page marker, inverted primary button on primary background, background-image scrim, form error states. |
| Security | Razor escapes text (`Text_values_are_html_escaped`); locked slots render the designer's value even if a value was stored. |

### Deviations / notes
- React 19 SSR hoists image preload hints; the parity harness strips them (not component markup).
- Mobile nav links stay visible without JavaScript (progressive enhancement); `site.js` collapses them.

---

## M3 — Section designer ✅

### Built
- **Section library** (`/designer/sections`): table with category, latest version and status
  badges (Draft / Published / Unpublished changes / Archived); create (name + category with
  suggestions), duplicate, archive/restore, show-archived toggle.
- **Section designer** (`/designer/sections/:id`):
  - *Palette + outline* in one dnd-kit context (both in the editor document, so drags never
    cross into the canvas iframe). Drops resolve through pure functions (`outlineModel.ts`:
    rows, drop zones before/inside/after, zone → tree location) and the same `canPlace` rules as
    clicks, so a drop the server would reject is shown in red and ignored. Palette items are
    disabled where they cannot go (e.g. Nav inside a repeater).
  - *Outline* is an ARIA `tree`: ↑/↓ select, Alt+↑/↓ move, Alt+→/← nest/un-nest, Del delete,
    Ctrl+D duplicate, plus toolbar buttons (enabled only when the move would change something).
  - *Canvas*: the real React renderer in the same-origin iframe; an editing adapter adds
    selection/hover outlines (display-contents wrappers) and placeholders for images without media.
    Links and forms in the canvas are inert.
  - *Properties panel*: token/preset styles per primitive (columns count/ratio/gap/valign/stack
    breakpoint, repeater key/label/min/max/default/layout, …); slot editor for key (pattern +
    uniqueness checked before it reaches the document), label, editable/locked, required,
    maxLength and default content (text, TipTap rich text, media library + alt text, URL link).
  - *Preview*: device toggle (375/768/1280) on the canvas, a dialog with all three widths side
    by side, and a theme-preset picker.
  - *Versioning*: debounced autosave of name, category and definition (`If-Match`, conflict
    dialog on 409, violations shown on 422); undo/redo (buttons, Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z,
    also inside the iframe); "Publish version" flushes the save, then publishes with `If-Match`.
    Server publish checks (`publishIssues`, returned on every save) are listed above the canvas
    and clicking one selects the node it points at.
- Editor foundations reused by M4: `lib/documentStore.ts` (Immer patches, coalesced keystrokes),
  `lib/useAutosave.ts`, `lib/useUndoShortcuts.ts`, `components/canvas`, `components/richtext`,
  `components/media`, `components/editor/SaveIndicator.tsx`, `lib/themes.ts`.
- Seeded theme presets (Strata default, Coastal, Ink).
- API JSON uses strict number handling, so the generated client types numbers as `number`.

### Verification
| Criterion | How |
|---|---|
| Designer builds Columns → Repeater → (Image + Heading + RichText) | `e2e/tests/m3-section-designer.spec.ts`: drags Columns from the palette onto the section and a Repeater into Column 1 (real pointer events, `e2e/support/dnd.ts`), clicks Image/Heading/Rich text into the repeater, asserts outline depth and the rendered `.st-columns .st-repeater .st-repeater__item` ×3 in the canvas iframe |
| Locks one slot | Sets the heading's default and switches it to Locked; the published v1 definition fetched from `/api/library` contains `"mode":"locked"` |
| Previews at 375 px | Device toggle → canvas iframe is 375 px wide and the repeater items share one column; preview dialog renders all three widths with the "Coastal" preset; screenshots captured and inspected |
| Publishes version 1 | "Publish version" → "Published version 1", header shows v1, button disabled with nothing new to publish; library row shows v1 + Published |
| Validation before publishing | Same test: an impossible repeater default (min 4 > default 3) lists a publish issue and disables publishing; fixing it clears it. Server rules unchanged from M1 (`SectionDefinitionRules`, Domain tests) |
| Keyboard/outline fallback + undo | Same test: Alt+↑ reorders in the outline, the Undo button restores the order |
| Unit level | Vitest: tree operations, primitive factories, outline rows/drop zones/drop locations, document store history and coalescing |
| Seeded presets | `Seeded_theme_presets_are_listed_for_designers_and_owners` |

Totals: 160 .NET tests, 66 frontend unit tests, 4 e2e tests — all green.

### Deviations / decisions
- Drag and drop in the designer targets the outline (the tree) rather than the canvas; the
  canvas is for selection and preview. This matches "drag primitives from a palette into the
  tree" and keeps all dnd-kit drags inside one document.
- Link slot defaults can only be external URLs: a section definition has no pages to point at.
- The API allows publishing an unchanged draft as a new version (existing behaviour); the UI
  disables the button when there is nothing new.
- At 1280 px the canvas is wider than the space between the side panels and scrolls
  horizontally rather than being scaled (scaling would distort hit-testing for selection).
- Theme presets are seeded with the development accounts (`Seed:Enabled`), not in production.

### Known issues
- dnd-kit reports `over` for a pointer position only after `onDragMove` for that position;
  drops are therefore resolved in `onDragOver` and again from the final `onDragEnd` event
  (commented in `StructurePanel.tsx`).
- Drag and drop has no keyboard sensor; keyboard users use the outline shortcuts/buttons
  (the brief's accessible fallback).

---

## M4 — Site editor and starter templates ✅

### Built
- **One editor for sites and templates** (`features/site-editor/SiteEditor.tsx`); the author
  (`owner` | `designer`) decides what lock rules apply. Templates add section lock flags
  (none/required/locked, including on the global header/footer), theme token locks, metadata
  (name, description, thumbnail) and "Publish version".
- **Canvas**: `PageView` (with hidden sections) in the same-origin iframe plus an editing
  adapter: `contentEditable="plaintext-only"` for text slots, TipTap for rich text (the
  formatting bar lives in the editor chrome and drives the editor inside the iframe), image
  slots open the media library + per-use alt text, buttons get a link chip that opens a
  label/link dialog (page picker or URL), repeater items get move/remove controls and an
  "Add …" button within min/max. Locked slots and locked sections render read-only with a
  lock icon and tooltip. Nav links switch the edited page.
- **Overlay** (editor document, Tailwind) aligned to section boxes measured inside the iframe
  (Resize/MutationObserver): hover/selection outlines, a toolbar (drag handle, move up/down,
  duplicate, hide, background image, delete, template lock select) whose buttons are disabled
  with a reason when a lock forbids them. Library cards and section handles drop between
  sections; during a drag the iframe lets pointer events through so dnd-kit never tracks the
  pointer across documents.
- **Panels**: Pages (sortable = nav order, add, duplicate, delete with lock/home guards,
  settings dialog: title, slug, show in nav, SEO title/description), Add section (library by
  category with live mini-previews; click appends, drag inserts), Theme (8 colours, 2 fonts,
  radius; owners see locked tokens disabled with a lock; designers toggle locks; WCAG AA
  warnings for text/background and onPrimary/primary; presets apply unlocked tokens only),
  Settings (site name/address via PATCH, firm name, logo, global header/footer; template
  metadata).
- **Sites**: list with published/unpublished-changes badges, delete; new site from a published
  template or blank (auto slug). **Templates**: list, create (theme preset), archive/restore.
- `siteModel.ts`: pure document operations + permissions mirroring `LockRules` (unit tested);
  `@strata/schema` `contrast.ts` with `fixtures/contrast.json` (shared with M5's .NET checks).

### Verification
| Criterion | How |
|---|---|
| Owner creates a site from a template | `e2e/tests/m4-site-editor.spec.ts` (serial): the designer test builds the template in the UI (library clicks, lock flag, brand-colour token locks, publish v1); the owner picks it on /sites/new and the canvas renders it |
| Adds the M3 section | The Columns → Repeater → (Image + Heading + RichText) section is dragged from the library between two sections; order and rendered repeater items asserted |
| Edits text inline | Types into the headline `contentEditable`; server draft contains the new text |
| Locked slot cannot be edited | Locked disclaimer has no editable element, shows the lock tooltip, and no value is stored for it; the locked band's slots are read-only and its Delete button is disabled |
| Reorders sections by drag | Drag handle moves the team grid above the hero |
| Undo/redo | Ctrl/Cmd+Z restores the order, Shift+Ctrl/Cmd+Z re-applies it |
| Unlocked vs locked theme colour | Accent hex changes (saved), Primary is disabled with the lock indicator and unchanged on the server |
| Uploads an image | PNG uploaded via the image dialog with alt text; canvas shows `/media/{id}`; stored value has the alt text |
| Also covered | Repeater "Add member", TipTap bio + Bold from the formatting bar (stored as sanitised `<strong>`), button label + page link via the dialog |
| Unit level | `siteModel.test.ts` (permissions vs lock rules, drop-index moves, default-item materialisation, min/max, page ops), contrast vectors |
| Server | Lock bypass tests from M1 unchanged; new regression test for empty template descriptions |

Screenshots captured by the tests were inspected (template editor, owner editor with theme
panel, uploaded image, locked tokens).

Totals: 161 .NET tests, 90 frontend unit tests, 6 e2e tests — all green.

### Deviations / decisions
- The M3 section used by the M4 test is created through the API in the test's setup (same
  Columns → Repeater → Image/Heading/RichText shape), so the spec does not depend on the M3
  spec having run first.
- The section toolbar is anchored top-left so it stays visible when the 1280 px canvas is wider
  than the viewport.
- Global header/footer are chosen in Settings rather than by drag and drop.
- Image slots inside the canvas are wrapped in a clickable block (`stx-image-edit`) — an
  editor-only wrapper; published markup is unchanged (parity tests untouched).

### Bugs found and fixed
- `UpdateTemplateRequest.Description` was `[Required]`, which rejects `""`; templates created
  without a description could never be saved (400). Fixed with `AllowEmptyStrings` + test.
- `CanvasFrame` called `onDocument(null)` whenever the callback identity changed, which cleared
  the overlay's frame document on every render.
- dnd-kit drop handling needs the draggable's node ref, not only its activator ref.

### Known issues
- Section drags have no keyboard sensor; the toolbar's move up/down buttons are the keyboard path.
- A 400 that is not a content violation shows only "Save failed" (details are in the network
  response), e.g. if a field limit is exceeded outside the content schema.

---

## M5 — Publishing and public sites ✅

### Built
- **Publish checks** (`Strata.Domain/Publishing/PublishChecks.cs`, pure): errors — empty
  required slots, images without alt text (incl. the logo), links to missing pages, missing
  section definitions; warnings — not exactly one h1 per page, skipped heading levels (header,
  page and footer headings in document order; empty headings are not rendered so not counted),
  theme contrast below WCAG AA (`Contrast.cs`, same vectors as the TS helper). Hidden sections
  are skipped; repeater items (and default items) are checked individually.
- **API**: `GET /api/sites/{id}/publish-checks`, `POST /api/sites/{id}/publish` (optional
  `If-Match`; errors → 422 with `errors[]`; otherwise an immutable `PublishedSiteVersion`
  snapshot with the exact section definitions embedded), `GET /api/sites/{id}/submissions`.
  Owner-only; other users get 404.
- **Public sites**: `/s/{slug}/{page}` and `{slug}.localhost` (host rewrite middleware before
  routing; links become root-relative). Rendered by `Strata.Rendering` from the published
  snapshot only (snapshots cached in memory by version id — they are immutable). Full document
  with `<title>` (SEO title, page title · firm), meta description, canonical, Open Graph,
  `site.css`/`site.js`; `sitemap.xml`, `robots.txt`; styled, themed 404; strong ETag per
  version+page with 304s, `Cache-Control: public, no-cache`; CSP and Referrer-Policy.
- **Contact form**: `POST /s/{slug}/_contact` (works without JavaScript): the section must be a
  published, visible contact form on that page; server-side validation (required, lengths,
  email/phone format) re-renders the page with errors and values (422); honeypot posts get the
  normal success redirect but are not stored; fixed-window rate limit per IP + site
  (`PublicSites:ContactPermitLimit`/`ContactWindowSeconds`, default 5 per 10 minutes);
  post/redirect/get (303) to the page with a success message. Only the site id is logged.
- **Editor**: Publish dialog (saves, runs checks, groups errors/warnings, clicking an issue
  switches page, selects and scrolls to the section; "Publish now" disabled while errors
  remain; shows the public URL), status badge (not published / unpublished changes /
  published), View site link, Messages page listing submissions.
- `ContactSubmission` entity + migration; forwarded headers trusted only when
  `ForwardedHeaders:TrustProxy` is set (Compose, where only nginx reaches the API).

### Verification
| Criterion | How |
|---|---|
| Publish blocked by missing alt text, then fixed and published | `e2e/tests/m5-publishing.spec.ts`: image uploaded without alt → the publish dialog lists "The image “Photo” needs alt text." and disables "Publish now"; clicking the issue selects the section; alt added → published v1 |
| Public URL serves the change | Visitor page at `/s/{slug}/` shows the new headline, image alt and title; host routing `{slug}.localhost:5081` serves the same content |
| Draft edits not public until next publish | Headline edited and saved (status "Unpublished changes"); public page still shows v1; after publishing v2 it shows the edit |
| Contact submission appears in the editor | Visitor submits the public form → success message; the owner's Messages page lists it |
| Server rules | `PublishingApiTests` (blocking errors → 422, versioning, snapshot isolation, SEO/meta/canonical/OG, ETag 304, CSP, sitemap/robots, styled 404 for unknown pages and unpublished sites, host routing, cross-owner 404s) and `ContactFormTests` (stored + 303, invalid → 422 with errors and values, honeypot dropped, wrong section → 400, rate limit → 429) |
| Checks logic | `PublishChecksTests` (each error/warning, repeater items, hidden sections, logo) and `ContrastTests` (shared vectors) |
| Compose | `docker compose up --build`: `/s/…` and `*.localhost` reach the API through nginx (styled 404 smoke test) |

Screenshots inspected: blocked publish dialog, published page, Messages page.
Totals: 190 .NET tests, 90 frontend unit tests, 7 e2e tests — all green.

### Deviations / decisions
- Publish checks are `GET` (no side effects) rather than the `POST` sketched in PLAN.md.
- Non-ASCII characters in published HTML are emitted as numeric entities by Razor's default
  encoder; valid HTML, slightly larger output.
- Published pages always revalidate (`no-cache` + ETag) so a new publish is visible
  immediately; 304s keep it cheap.

### Known issues
- The rate limiter is in-memory per API instance (fine for a single instance).

---

## M6 — Seed content ✅

### Built
- `Strata.Infrastructure/Seeding/Demo/HarborPine.cs` (pure): ten section types built from
  primitives in the content model — Site header (Nav + "Book a call"), Hero with image
  (heading, subtext, CTA, background image), Services grid (repeater of cards), About and
  philosophy, Team bios (repeater: photo, name, title, bio), Our process (repeater of numbered
  steps), FAQ (repeater), Call to action band, Contact (contact form + office details), Site
  footer (with a **locked** regulatory disclosure). Original copy for the fictional
  "Harbor & Pine Wealth Partners".
- Starter template "Harbor & Pine Advisor": Home, About, Services, Contact; footer
  **locked**, header and contact **required**, `primary`/`secondary` **locked**; published v1
  with a thumbnail.
- Demo site `harbor-pine`: an independent copy of template v1, owned by the seeded site
  owner, published v1 → `/s/harbor-pine/` and `http://harbor-pine.localhost:5080/`.
- `PlaceholderImages.cs`: harbour, hills, three abstract portraits and a logo mark drawn with
  the existing PNG encoder at seed time and stored through `IFileStorage` as designer media.
- `DemoContentSeeder`: idempotent (skips when the template exists), runs from
  `DatabaseInitializer` when `Seed:Enabled` and `Seed:DemoContent` (default true) are set;
  refuses to write content that fails `HarborPine.Verify` (definition rules, document
  validator, publish-check errors).

### Verification
| Criterion | How |
|---|---|
| Fresh start shows the demo site live | `e2e/tests/m6-seed-content.spec.ts`: the e2e database is created fresh and the API seeds it on startup (same path as `make dev`); `/s/harbor-pine/` has the SEO title, hero, logo, locked disclosure; nav reaches About (team portraits), Services (FAQ), Contact (form); host routing serves `/about`; screenshots at 1280 and 375 px inspected |
| Template usable end to end | Same spec: the owner sees the published demo site, creates "Cedar Cove Advisors" from the template, edits the headline and firm name, sees the footer locked, publish checks pass with no issues, publishes and the public page shows the edit |
| Content validity | `HarborPineContentTests`: covers the ten section types, `Verify` is empty, every definition and the template match the JSON Schema, template locks match the brief |
| Seeder | `DemoContentTests`: seeds twice (idempotent), all four public pages 200, generated PNGs served, template offered with 4 pages, a site created from it has zero publish errors **and warnings** |

Totals: 195 .NET tests, 90 frontend unit tests, 9 e2e tests — all green.

### Bugs found and fixed
- Site CSS: `.st-site a { color: inherit }` out-ranked `.st-button--primary`, so primary link
  buttons on light backgrounds had dark text on navy. Now `:where(.st-site) a`.
- Published pages kept the browser's 8px body margin (the editor iframe reset it, hiding the
  bug). `site.css` resets `body`.
- e2e drag helper did not scroll the source into view (exposed by the longer library).

### Notes
- API integration tests disable demo content (`Seed:DemoContent=false`) except
  `DemoContentTests`, which runs the seeder explicitly.
- Existing development databases get the demo content on the next start (the seeder only
  checks for the template).
