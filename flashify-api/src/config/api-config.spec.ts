import { describe, expect, it } from "vitest";
import { loadApiConfig } from "./api-config.js";

describe("API configuration", () => {
  it("uses safe local defaults", () => {
    expect(loadApiConfig({})).toEqual({
      environment: "development",
      port: 4000,
      supabaseUrl: "http://127.0.0.1:54321",
    });
  });

  it("rejects an invalid API port", () => {
    expect(() =>
      loadApiConfig({
        API_PORT: "0",
        SUPABASE_URL: "http://127.0.0.1:54321",
      }),
    ).toThrow();
  });
});
