import { describe, expect, it } from "vitest";
import { readCookie } from "./client";
import { ApiError, isProblemDetails } from "./problem";

describe("readCookie", () => {
  it("finds a cookie among several and decodes it", () => {
    expect(readCookie("XSRF-TOKEN", "a=1; XSRF-TOKEN=abc%3D%3D; b=2")).toBe("abc==");
  });

  it("keeps '=' characters inside the value", () => {
    expect(readCookie("t", "t=x=y")).toBe("x=y");
  });

  it("returns undefined when absent", () => {
    expect(readCookie("missing", "a=1")).toBeUndefined();
  });
});

describe("ApiError", () => {
  it("exposes status helpers and the problem title", () => {
    const error = new ApiError(409, { title: "Conflict", status: 409 });
    expect(error.isConflict).toBe(true);
    expect(error.isValidation).toBe(false);
    expect(error.message).toBe("Conflict");
  });

  it("recognises problem details bodies", () => {
    expect(isProblemDetails({ title: "x" })).toBe(true);
    expect(isProblemDetails("nope")).toBe(false);
  });
});
