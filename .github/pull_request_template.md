## Summary

<!-- What does this change and why? Link the issue it closes, e.g. "Closes #123". -->

## How it was tested

<!-- Tests added or updated, and the commands you ran. Add screenshots for UI changes. -->

## Checklist

- [ ] `./scripts/test.sh` passes (build, .NET tests, generated code, format, lint, typecheck, unit tests)
- [ ] `./scripts/e2e.sh` passes, or the change cannot affect end-to-end flows
- [ ] Schema changes were made in `schema/strata-content.schema.json` first and regenerated with `pnpm gen`
- [ ] Rendering changes are in both renderers, with parity fixtures updated
- [ ] Docs updated where needed (README, PLAN.md, PROGRESS.md, an ADR, CHANGELOG.md)
