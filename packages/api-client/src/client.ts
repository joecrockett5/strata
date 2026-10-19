import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./generated";
import { ApiError, isProblemDetails } from "./problem";

export const ANTIFORGERY_COOKIE = "XSRF-TOKEN";
export const ANTIFORGERY_HEADER = "X-XSRF-TOKEN";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function readCookie(name: string, cookieString: string = document.cookie): string | undefined {
  for (const part of cookieString.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return undefined;
}

/** Echoes the double-submit antiforgery cookie on unsafe requests. */
export const antiforgeryMiddleware: Middleware = {
  onRequest({ request }) {
    if (!SAFE_METHODS.has(request.method.toUpperCase())) {
      const token = readCookie(ANTIFORGERY_COOKIE);
      if (token) {
        request.headers.set(ANTIFORGERY_HEADER, token);
      }
    }
    return request;
  },
};

/** Converts error responses into {@link ApiError}s carrying the ProblemDetails body. */
export const problemMiddleware: Middleware = {
  async onResponse({ response }) {
    if (response.ok) {
      return response;
    }
    let body: unknown = undefined;
    try {
      body = await response.clone().json();
    } catch {
      // Non-JSON error body; fall through with a synthetic problem.
    }
    throw new ApiError(
      response.status,
      isProblemDetails(body) ? body : { status: response.status, title: response.statusText },
    );
  },
};

export type StrataClient = ReturnType<typeof createStrataClient>;

export function createStrataClient(baseUrl = "") {
  const client = createClient<paths>({ baseUrl, credentials: "same-origin" });
  client.use(antiforgeryMiddleware, problemMiddleware);
  return client;
}
