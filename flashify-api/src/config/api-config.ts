import { z } from "zod";

const apiConfigSchema = z.object({
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type ApiConfig = {
  port: number;
  environment: "development" | "test" | "production";
};

export function loadApiConfig(
  environment: Readonly<Record<string, string | undefined>>,
): ApiConfig {
  const parsed = apiConfigSchema.parse({
    API_PORT: environment.API_PORT,
    NODE_ENV: environment.NODE_ENV,
  });

  return {
    port: parsed.API_PORT,
    environment: parsed.NODE_ENV,
  };
}
