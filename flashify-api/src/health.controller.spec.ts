import { describe, expect, it } from "vitest";
import { HealthController } from "./health.controller.js";

describe("HealthController", () => {
  it("returns the shared stable health response", () => {
    expect(new HealthController().getHealth()).toEqual({
      service: "flashify-api",
      status: "ok",
    });
  });
});
