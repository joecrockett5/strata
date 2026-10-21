# Thin wrapper: the real logic lives in scripts/*.sh so it also works without make.
.PHONY: dev test e2e screenshots up down gen

dev:   ## Postgres in Docker + dotnet watch + vite
	./scripts/dev.sh

test:  ## build, lint, typecheck, unit and integration tests
	./scripts/test.sh

e2e:   ## Playwright end-to-end tests
	./scripts/e2e.sh

up:    ## Whole stack in Docker (http://localhost:8080)
	docker compose up --build -d --wait

down:
	docker compose down

screenshots: ## Regenerate docs/screenshots from seeded content
	./scripts/screenshots.sh

gen:   ## Regenerate schema types and the TypeScript API client
	dotnet build src/Strata.Api && pnpm gen
