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
