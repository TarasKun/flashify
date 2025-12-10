import { z } from "zod";

export const authBootstrapRequestSchema = z
  .object({
    deviceId: z.uuid(),
    deviceName: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export type AuthBootstrapRequest = z.infer<typeof authBootstrapRequestSchema>;

export const authBootstrapResponseSchema = z
  .object({
    device: z.object({
      id: z.uuid(),
      name: z.string().nullable(),
    }),
    user: z.object({
      avatarUrl: z.string().nullable(),
      displayName: z.string().nullable(),
      email: z.email(),
      id: z.uuid(),
    }),
  })
  .strict();

export type AuthBootstrapResponse = z.infer<typeof authBootstrapResponseSchema>;
