# CLAUDE.md — working notes for Strata

Read `PLAN.md` (architecture), `PROGRESS.md` (what is done / known issues) and the brief before
starting work. Keep all three current.

## Environment

- .NET SDK and Node are user-local installs on the dev machine: run `source ~/.strata-env` in
  non-interactive shells (the `scripts/*.sh` do this automatically via `scripts/lib.sh`).
- `make` is not installed on the dev machine; call `./scripts/*.sh` directly (the Makefile only
  delegates to them).
- Docker is available; Postgres runs via `docker compose up -d --wait db` (port 5432,
  user/password/db `strata`).

## Commands

| Task | Command |
|---|---|
| Dev loop (db + `dotnet watch` + vite) | `./scripts/dev.sh` (`make dev`) — editor http://localhost:5173, API http://localhost:5080 |
| All checks except e2e | `./scripts/test.sh` (`make test`) |
| E2E (Playwright) | `./scripts/e2e.sh [playwright args]` (`make e2e`) — ports 5081/5174, db `strata_e2e` (reset each run) |
| Full stack in Docker | `docker compose up --build -d --wait` → http://localhost:8080 |
| .NET build / tests | `dotnet build`, `dotnet test` (Testcontainers starts its own Postgres) |
| Single .NET test | `dotnet test --project tests/Strata.Api.Tests -- --filter-method "*Name*"` |
| Frontend checks | `pnpm lint`, `pnpm typecheck`, `pnpm test` |
| New EF migration | `dotnet ef migrations add <Name> -p src/Strata.Infrastructure -o Persistence/Migrations` |
| Regenerate generated code | `dotnet build src/Strata.Api && pnpm gen` (schema types + OpenAPI client; both committed, CI checks staleness) |

## Where things live

- `src/Strata.Domain` — content model + rules (no infrastructure deps).
- `src/Strata.Infrastructure` — EF Core (`Persistence/`), Identity, seeding, storage, sanitiser.
- `src/Strata.Rendering` — Razor components for published sites.
- `src/Strata.Api` — `Features/<Area>/<Area>Endpoints.cs` (minimal APIs), `Infrastructure/` for
  cross-cutting concerns (auth setup, antiforgery).
- `schema/strata-content.schema.json` — **the** content model. Change it first, then `pnpm gen`,
  then the C# records in `Strata.Domain/Content` (round-trip tests catch drift).
- `fixtures/content/` — JSON fixtures shared by .NET and TS tests.
- `src/Strata.Domain/Content/Validation` — definition rules, document validator, lock rules (pure).
- `src/Strata.Api/Features/Content/ContentWritePipeline.cs` — the only path for content writes.
- `tests/Strata.Testing` — content builders (`using static Strata.Testing.Content`).
- `tests/Strata.Api.Tests` — integration tests; derive from `ApiTestBase`, use `DesignerAsync()` /
  `OwnerAsync()` helpers. The DB is migrated + seeded once by `PostgresFixture`.
  Use `StrataApiFactory.LoginProbe` (never Owner) for failed-login tests.
- `packages/renderer` — React renderer + `parity/` harness; `packages/site-styles` — site.css/site.js
  (served by the API at `/site-assets/`).
- `src/Strata.Rendering` — Razor components (`Components/`, `Nodes/`) + `StrataRenderer`.
- `apps/editor/src` — `app/` (router, shell), `features/<area>/`, `components/ui/`, `lib/`.
  Shared editor plumbing: `lib/documentStore.ts` (Zustand + Immer patches, undo/redo),
  `lib/useAutosave.ts` (debounced `If-Match` saves), `lib/useUndoShortcuts.ts`,
  `components/canvas/` (iframe + portal, `canvasCss.ts` for `stx-` editor-only styles),
  `components/richtext/`, `components/media/`, `components/editor/SaveIndicator.tsx`.
- `apps/editor/src/features/section-designer` — `tree.ts` (pure tree ops + placement rules),
  `outlineModel.ts` (outline rows, drop zones), `primitives.ts` (palette + factories),
  `designer/` (page, state/commands, panels, canvas), `library/`.
- `packages/api-client` — generated `openapi/strata-api.json` and `src/generated.ts` (both
  committed; CI fails if stale) plus the fetch client.
- `e2e/` — Playwright; `support/` has login helpers, seeded accounts and `dnd.ts` (dnd-kit needs
  stepped pointer moves; Playwright's `dragTo` does not activate it).

## Rendering parity workflow

1. Change markup in **both** `packages/renderer/src` (React) and `src/Strata.Rendering` (Razor).
   Shared rules: `model.ts`/`classes.ts` ↔ `RenderRules.cs`/`Css.cs`.
2. Add or adjust a fixture in `fixtures/parity/*.json` if new behaviour needs coverage.
3. `pnpm parity:generate` → review the `*.expected.html` diff.
4. `dotnet test --project tests/Strata.Rendering.Tests` (Razor vs snapshot) and
   `pnpm --filter @strata/renderer test` (React vs snapshot).

## Conventions

- Conventional Commits; tag milestones `m0`…`m7`.
- C#: nullable on, warnings are errors, file-scoped namespaces, `sealed` by default, records for
  DTOs, `TypedResults` in endpoints, ProblemDetails for every error, 422 + `errors[]` for
  content-validation failures, 404 (not 403) for other users' sites.
- Never log secrets or contact-form personal data. Use `[LoggerMessage]` source-generated logs.
- TS: strict + `noUncheckedIndexedAccess`; ESLint `strictTypeChecked`. Path alias `@/` in the editor.
- Site CSS (`packages/site-styles`): class names prefixed `st-`, tokens as `--st-*` custom
  properties, mobile-first, **no `vh` units** (the editor canvas iframe is auto-height).
- The React renderer must not import editor-only libraries.
- Format with Prettier (`pnpm format`); committed files are expected to pass `pnpm format:check`.
- Editor-only markup inside the canvas uses `stx-`/`data-stx-*`; it must never reach published HTML.
- Never weaken a test or validation to make a check pass; record problems in PROGRESS.md.
