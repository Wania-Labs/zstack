import { z } from "zod";

export const HealthResponse = z
  .object({
    ok: z.literal(true),
    requestId: z.string().min(1),
    database: z.literal("up"),
  })
  .strict();

export type HealthResponse = z.infer<typeof HealthResponse>;
