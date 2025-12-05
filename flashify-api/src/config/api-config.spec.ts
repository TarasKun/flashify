import { describe, expect, it } from "vitest";
import { loadApiConfig } from "./api-config.js";

describe("API configuration", () => {
  it("uses safe local defaults", () => {
    expect(loadApiConfig({})).toEqual({
      environment: "development",
      port: 4000,
    });
  });

  it("rejects an invalid API port", () => {
    expect(() => loadApiConfig({ API_PORT: "0" })).toThrow();
  });
});
