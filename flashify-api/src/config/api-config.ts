import { z } from "zod";

const apiConfigSchema = z.object({
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgresql://postgres:postgres@127.0.0.1:54322/postgres?schema=public"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SUPABASE_URL: z.url().default("http://127.0.0.1:54321"),
});

export type ApiConfig = {
  databaseUrl: string;
  port: number;
  environment: "development" | "test" | "production";
  supabaseUrl: string;
};

export function loadApiConfig(
  environment: Readonly<Record<string, string | undefined>>,
): ApiConfig {
  const parsed = apiConfigSchema.parse({
    API_PORT: environment.API_PORT,
    DATABASE_URL: environment.DATABASE_URL,
    NODE_ENV: environment.NODE_ENV,
    SUPABASE_URL: environment.SUPABASE_URL,
  });

  return {
    databaseUrl: parsed.DATABASE_URL,
    port: parsed.API_PORT,
    environment: parsed.NODE_ENV,
    supabaseUrl: parsed.SUPABASE_URL.replace(/\/$/, ""),
  };
}
