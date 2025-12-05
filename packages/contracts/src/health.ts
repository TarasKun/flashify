import { z } from "zod";

export const healthResponseSchema = z
  .object({
    service: z.literal("flashify-api"),
    status: z.literal("ok"),
  })
  .strict();

export type HealthResponse = z.infer<typeof healthResponseSchema>;
