# Strata

A section-based website builder: designers compose reusable **sections** from layout and content
primitives and assemble **starter templates**; site owners build sites from them in an inline,
drag-and-drop editor and publish fast, server-rendered pages.

> Work in progress — see `PROGRESS.md`. Full documentation lands in milestone M7.

## Quick start

Requirements: Docker, .NET SDK 10, Node 24 with corepack (pnpm).

```bash
make dev          # or ./scripts/dev.sh — Postgres in Docker, API (dotnet watch), editor (vite)
```

- Editor: http://localhost:5173
- API: http://localhost:5080 (OpenAPI at `/openapi/v1.json`)

Or the whole stack in Docker: `docker compose up --build` → http://localhost:8080

## Development accounts (seeded in Development only)

| Role | Email | Password |
|---|---|---|
| Designer | `designer@strata.local` | `Designer!2026` |
| Site owner | `owner@strata.local` | `Owner!2026` |

## Tests

```bash
make test         # build (warnings as errors), .NET tests (Testcontainers), lint, typecheck, unit tests
make e2e          # Playwright end-to-end tests
```
