import { z } from "zod";

export const StaffCapability = z.enum(["staff.console"]);

export type StaffCapability = z.infer<typeof StaffCapability>;

export const StaffMeResponse = z
  .object({
    userId: z.string().min(1),
    email: z.string().email(),
    name: z.string().min(1),
    role: z.string().nullable(),
    capabilities: z.array(StaffCapability),
  })
  .strict();

export type StaffMeResponse = z.infer<typeof StaffMeResponse>;
