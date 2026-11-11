# Changelog

All notable changes to Strata are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The project was built in milestones
(M0–M7); [`PROGRESS.md`](PROGRESS.md) has the detail behind every entry, including how each
requirement was verified.

## [Unreleased]

### Added

- MIT licence, contributing guide, code of conduct, security policy and this changelog.
- Issue forms, a pull request template, CODEOWNERS and CodeQL scanning.
- README hero banner, badges, a recorded demo GIF and a screenshot gallery.
- `scripts/demo-gif.sh` records the README demo with Playwright (crisp DevTools screencast plus
  a visible cursor) and encodes it with ffmpeg. `scripts/screenshots.sh` now also captures the
  template editor and renders the banner.
- `.gitattributes`: LF line endings, and generated code marked so GitHub collapses it in diffs
  and leaves it out of the language stats.

### Changed

- Dependency updates: TypeScript 6, jsdom 31, HtmlSanitizer 11, the .NET and frontend
  minor/patch groups, nginx 1.31 and the latest major versions of the GitHub Actions used in CI.

## M7 — Polish and docs

### Added

- README with highlights, architecture diagram, setup, seeded accounts, a two-minute reviewer
  demo, screenshots, test suites and known limitations.
- ADR 0005: the editor canvas design (same-origin iframe, inline editors, drag-and-drop overlay).
- Playwright-captured README screenshots (`scripts/screenshots.sh`).
- Prettier formatting enforced in `scripts/test.sh` and CI.

### Fixed

- `make gen` regenerates the schema types as well as the API client.
- The API Docker image creates its media directory owned by the app user.

## M6 — Seed content

### Added

- Ten "Harbor & Pine" section types built from the content model's primitives, including a
  site footer with a locked regulatory disclosure.
- The "Harbor & Pine Advisor" starter template with locked brand colours and required
  sections, and the published demo site `harbor-pine`.
- Placeholder images drawn at seed time, so nothing is downloaded.

## M5 — Publishing and public sites

### Added

- Publish checks: errors for empty required slots, missing alt text and broken links; warnings
  for h1 count, skipped heading levels and WCAG AA contrast.
- Immutable published snapshots that embed every section definition they use.
- Server-rendered public sites at `/s/{slug}` and `{slug}.localhost`, with SEO and Open Graph
  tags, sitemap, robots, a styled 404, ETags and a CSP.
- A contact form that works without JavaScript, with server validation, a honeypot and rate
  limiting.
- Publish dialog, status badges and a messages inbox in the editor.

## M4 — Site editor and starter templates

### Added

- One editor for sites and templates: inline text and rich-text editing, media and links,
  drag-and-drop sections, pages panel, theme panel with contrast warnings, undo/redo and
  autosave.
- Template-only controls for section locks and theme token locks.
- Creating sites from published templates as independent copies.

## M3 — Section designer

### Added

- Section library with versions and status badges.
- Visual section designer: palette, keyboard-accessible outline tree, live canvas, properties
  and slot editor, responsive preview, autosave and versioned publishing.

## M2 — Renderers

### Added

- `@strata/site-styles`: the hand-written, mobile-first published stylesheet and progressive
  enhancement script.
- `@strata/renderer` (React) and `Strata.Rendering` (Razor) with a parity harness that keeps
  their HTML identical.

## M1 — Content model and API

### Added

- The JSON Schema content model, generated TypeScript types and matching C# records.
- Definition rules, the site document validator and server-side lock rules.
- EF Core persistence with `jsonb`, the HTML sanitiser, image sniffing and file storage.
- APIs for section types, templates, sites and media through a single content write pipeline.

## M0 — Plan and scaffold

### Added

- .NET 10 solution, pnpm workspace, ASP.NET Core Identity with cookie auth and antiforgery,
  EF Core with PostgreSQL, OpenAPI generation, Docker Compose and GitHub Actions CI.

[Unreleased]: https://github.com/joecrockett5/strata/commits/main
