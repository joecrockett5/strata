import { describe, expect, it } from "vitest";
import { type CurrentUser, hasRole } from "./auth";

const user = (roles: string[]): CurrentUser => ({ id: "1", email: "a@b.c", displayName: "A", roles });

describe("hasRole", () => {
  it("is true only for roles the user holds", () => {
    expect(hasRole(user(["Designer"]), "Designer")).toBe(true);
    expect(hasRole(user(["Designer"]), "SiteOwner")).toBe(false);
  });

  it("is false for anonymous users", () => {
    expect(hasRole(null, "Designer")).toBe(false);
    expect(hasRole(undefined, "SiteOwner")).toBe(false);
  });
});
