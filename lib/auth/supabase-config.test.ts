import { describe, expect, it } from "vitest";
import { readSupabaseConfig } from "./supabase-config";

describe("Supabase browser config", () => {
  it("returns null until both public values are configured", () => {
    expect(readSupabaseConfig({})).toBeNull();
    expect(
      readSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      }),
    ).toBeNull();
  });

  it("accepts the public URL and publishable key", () => {
    expect(
      readSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      }),
    ).toEqual({
      publishableKey: "sb_publishable_example",
      url: "https://example.supabase.co",
    });
  });
});
