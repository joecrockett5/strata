# 0001 — Two renderers kept in sync by parity tests

## Context

The editor needs a live, interactive canvas (React). Published sites must be server-rendered by
.NET for SEO, speed and so public hosting does not depend on a JavaScript runtime. Two
implementations of "how a section looks" will drift unless something forces them to agree.

## Decision

- **React renderer** (`packages/renderer`) renders site content in the editor canvas. It has no
  editor dependencies. An optional **editing adapter** (React context) lets the editor replace
  slot content with inline editors and decorate nodes, sections and repeater items. With no
  adapter — or an adapter with no hooks — it emits exactly the published markup.
- **Razor renderer** (`Strata.Rendering`) renders published sites with Razor *components*
  through `HtmlRenderer` (static HTML; no Blazor runtime on the page). One component per primitive
  mirrors one React component per primitive; shared rules live in `RenderRules`/`Css` (C#) and
  `model.ts`/`classes.ts` (TS) with matching names.
- Both emit the same markup and BEM-style `st-` class names, styled by **one hand-written
  stylesheet** (`packages/site-styles/src/site.css`) that the API serves at `/site-assets/site.css`
  and the editor injects into its canvas iframe. Theme colours become `--st-color-*` custom
  properties; fonts and radius become classes so font stacks live only in CSS.
- The render context is **plain data** (page hrefs, media base URL, nav, form state), never
  callbacks, so one JSON fixture drives both renderers.
- **Parity tests**:
  1. `fixtures/parity/*.json` — section definition + instance + theme + context (or a whole page).
  2. `pnpm parity:generate` renders each with React (`renderToStaticMarkup`, Prettier-formatted)
     into `*.expected.html`.
  3. `Strata.Rendering.Tests` renders the same inputs with Razor and compares after normalisation.
  4. Vitest re-renders with React and requires byte equality with the committed snapshots, so any
     markup change is deliberate and shows up in review.

### Normalisation

Both outputs are parsed with AngleSharp. Attribute order, class-token order and inline-style
declaration order/spacing are sorted; whitespace runs collapse, text is trimmed and
whitespace-only text nodes are dropped (snapshots are pretty-printed). Elements, nesting,
attribute values and text must otherwise match exactly. Unit tests pin both what the normaliser
forgives and what it must still catch.

React 19's server renderer hoists `<link rel="preload" as="image">` hints for eager images; these
are resource hints rather than component markup, so the harness strips them before snapshotting.

## Consequences

- Every primitive change is made twice, and the parity suite fails until both sides agree. A
  test asserts the fixtures exercise every primitive type.
- Behaviour that only exists on one side is explicit: hoisted resource hints (React SSR only), the
  editing adapter (React only), and the full HTML document/head (Razor only, see M5).
- The alternative — running the React renderer in Node from .NET — would remove duplication but
  add a Node runtime to public hosting and a process boundary to every page render.
