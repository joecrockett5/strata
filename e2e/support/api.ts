import { type APIRequestContext, expect, type Page } from "@playwright/test";

/** Calls the API with the page's session cookie and the double-submit antiforgery header. */
export async function api(page: Page) {
  const request: APIRequestContext = page.request;
  await request.get("/api/auth/antiforgery");
  const token = (await page.context().cookies()).find((c) => c.name === "XSRF-TOKEN")?.value ?? "";
  const headers = { "X-XSRF-TOKEN": token };

  const send = async (method: "POST" | "PUT", url: string, data: unknown, extra: Record<string, string> = {}) => {
    const response = await request.fetch(url, { method, data, headers: { ...headers, ...extra } });
    expect(response.ok(), `${method} ${url} → ${String(response.status())} ${await response.text()}`).toBe(true);
    return response;
  };

  return {
    /** Creates a section type with `definition` and publishes version 1. Returns its id. */
    async publishSection(name: string, category: string, definition: unknown): Promise<string> {
      const created = (await (await send("POST", "/api/section-types", { name, category, definition })).json()) as { id: string };
      await send("POST", `/api/section-types/${created.id}/versions`, undefined);
      return created.id;
    },
    async get<T>(url: string): Promise<T> {
      const response = await request.get(url);
      expect(response.ok()).toBe(true);
      return (await response.json()) as T;
    },
  };
}
