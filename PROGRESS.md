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
