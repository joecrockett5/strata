import { defineConfig, devices } from "@playwright/test";

// E2E runs on its own ports and database so it never collides with `make dev`.
const apiPort = 5081;
const editorPort = 5174;
const repoRoot = new URL("..", import.meta.url).pathname;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${editorPort}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: [
    {
      command: "dotnet run --project src/Strata.Api --no-build --no-launch-profile",
      cwd: repoRoot,
      url: `http://localhost:${apiPort}/health`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ASPNETCORE_ENVIRONMENT: "Development",
        ASPNETCORE_URLS: `http://localhost:${apiPort}`,
        ConnectionStrings__Strata:
          "Host=localhost;Port=5432;Database=strata_e2e;Username=strata;Password=strata",
        Storage__RootPath: `${repoRoot}.data/e2e-media`,
      },
    },
    {
      command: "pnpm --filter @strata/editor dev",
      cwd: repoRoot,
      url: `http://localhost:${editorPort}`,
      timeout: 60_000,
      reuseExistingServer: false,
      env: {
        STRATA_EDITOR_PORT: String(editorPort),
        STRATA_API_URL: `http://localhost:${apiPort}`,
      },
    },
  ],
});
