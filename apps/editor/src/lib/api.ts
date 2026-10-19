import { createStrataClient } from "@strata/api-client";

/** The single API client instance for the editor (same-origin; Vite proxies /api in dev). */
export const api = createStrataClient();
