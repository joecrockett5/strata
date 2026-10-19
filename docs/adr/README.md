# Architecture decision records

| # | Decision | Status |
|---|---|---|
| [0001](0001-dual-renderers-with-parity-tests.md) | Two renderers (React for the editor, Razor for published sites) kept in sync by parity tests | Accepted |
| [0002](0002-json-content-model-and-storage.md) | One JSON Schema for the content model; content stored as `jsonb` | Accepted |
| [0003](0003-server-authoritative-lock-enforcement.md) | Locking rules enforced on the server by diffing against the stored document | Accepted |
| [0004](0004-independent-copies-and-pinned-versions.md) | Sites are independent copies of templates; section instances pin immutable versions | Accepted |

Format: context → decision → consequences, kept short. Supersede rather than edit accepted ADRs.
