#!/usr/bin/env bash
# Regenerates docs/screenshots/*.png from a freshly seeded e2e stack.
set -euo pipefail
STRATA_SCREENSHOTS=1 exec "$(dirname "$0")/e2e.sh" tests/readme-screenshots.spec.ts "$@"
