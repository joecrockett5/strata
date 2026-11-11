# Contributing to Strata

Thanks for taking the time to contribute. This guide covers how to get a working checkout, the
checks a change has to pass and the conventions the codebase follows.

By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to contribute

- **Report a bug** with the [bug report form](../../issues/new?template=bug_report.yml). Include
  the steps to reproduce it and what you expected to happen.
- **Suggest a feature** with the [feature request form](../../issues/new?template=feature_request.yml).
  Check the [known limitations](README.md#known-limitations) first, because some of them are
  out of scope on purpose.
- **Report a vulnerability** privately. See [SECURITY.md](SECURITY.md) and do not open a public
  issue.
- **Send a pull request.** For anything bigger than a small fix, open an issue first so we can
  agree on the approach.

## Development setup

You need **Docker**, the **.NET SDK 10** and **Node 24** with corepack (pnpm).

```bash
git clone https://github.com/joecrockett5/strata.git
cd strata
corepack enable
./scripts/dev.sh        # installs packages, starts Postgres in Docker, the API (dotnet watch) and the editor (Vite)
```

The editor runs at http://localhost:5173 and the API at http://localhost:5080. The database is
migrated and seeded with demo accounts and content on first start (see the
[README](README.md#seeded-accounts-and-content)).

`make` is optional. Every Makefile target delegates to a script in `scripts/`.

## Checks

Run these before you open a pull request. CI runs the same commands.

```bash
./scripts/test.sh       # build (warnings are errors), .NET tests, generated-code staleness,
                        # Prettier, ESLint, typecheck, unit tests
./scripts/e2e.sh        # Playwright acceptance tests against a freshly seeded database
```

Useful narrower commands:

| Task | Command |
|---|---|
| One .NET test | `dotnet test --project tests/Strata.Api.Tests -- --filter-method "*Name*"` |
| Frontend only | `pnpm lint && pnpm typecheck && pnpm test` |
| Format | `pnpm format` |
| Regenerate schema types and the API client | `dotnet build src/Strata.Api && pnpm gen` |
| New EF migration | `dotnet ef migrations add <Name> -p src/Strata.Infrastructure -o Persistence/Migrations` |
| Refresh README screenshots and banner | `./scripts/screenshots.sh` |
| Re-record the README demo GIF (needs ffmpeg) | `./scripts/demo-gif.sh` |

## How the codebase fits together

Read [`PLAN.md`](PLAN.md) for the architecture and the [ADRs](docs/adr/README.md) for the
reasoning behind the main decisions. A few rules matter for most changes:

- **The content model starts in the schema.** Change `schema/strata-content.schema.json` first,
  run `pnpm gen`, then update the C# records in `src/Strata.Domain/Content`. Round-trip tests
  catch drift.
- **Every content write goes through `ContentWritePipeline`.** Do not add a second write path.
- **Rendering changes go in both renderers.** Update the React renderer in
  `packages/renderer/src` and the Razor components in `src/Strata.Rendering`, add or adjust a
  fixture in `fixtures/parity/`, run `pnpm parity:generate` and review the `*.expected.html` diff.
- **Locks are enforced on the server.** The editor mirrors the rules for a better experience,
  but `LockRules` is the source of truth. Add an API test that tries to bypass any new rule.
- **Editor-only markup** inside the canvas uses `stx-` classes and `data-stx-*` attributes, and
  must never reach published HTML.

## Coding conventions

- **C#:** nullable reference types on, warnings are errors, file-scoped namespaces, `sealed` by
  default, records for DTOs, `TypedResults` in endpoints, ProblemDetails for every error and
  `[LoggerMessage]` source-generated logging. Never log secrets or contact-form personal data.
- **TypeScript:** `strict` with `noUncheckedIndexedAccess`, ESLint `strictTypeChecked`, `@/`
  path alias in the editor. The React renderer must not import editor-only libraries.
- **Site CSS:** `st-` class prefix, `--st-*` tokens, mobile-first and no `vh` units.
- **Formatting:** Prettier (`pnpm format`) and `.editorconfig`.
- **Tests:** never weaken a test or a validation rule to make a check pass.

## Commits and pull requests

- Use [Conventional Commits](https://www.conventionalcommits.org/), for example
  `feat(site-editor): add section search` or `fix(api): return 404 for archived templates`.
- Keep pull requests focused on one change. Fill in the pull request template and link the
  issue it closes.
- Add or update tests with the change. UI changes should include a screenshot.
- Update the docs (`README.md`, `PLAN.md`, `PROGRESS.md`, an ADR or `CHANGELOG.md`) when the
  change affects them.
