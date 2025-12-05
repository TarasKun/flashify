import { describe, expect, it } from "vitest";
import { healthResponseSchema } from "./health.js";

describe("health response contract", () => {
  it("accepts the stable health response", () => {
    expect(
      healthResponseSchema.safeParse({
        service: "flashify-api",
        status: "ok",
      }).success,
    ).toBe(true);
  });

  it("rejects malformed and extra response fields", () => {
    expect(
      healthResponseSchema.safeParse({
        service: "other-service",
        status: "ok",
      }).success,
    ).toBe(false);
    expect(
      healthResponseSchema.safeParse({
        service: "flashify-api",
        status: "ok",
        version: "uncontracted",
      }).success,
    ).toBe(false);
  });
});
