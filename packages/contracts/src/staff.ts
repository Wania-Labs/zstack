import { z } from "zod";

export const StaffCapability = z.enum(["staff.console"]);

export type StaffCapability = z.infer<typeof StaffCapability>;

/** Roles that grant `staff.console` via product capability mapping. */
export const StaffRole = z.enum(["admin", "support", "operations", "owner"]);

export type StaffRole = z.infer<typeof StaffRole>;

/** Better Auth `admin.setRole` values: staff roles plus `user` to clear staff. */
export const AssignableUserRole = z.enum([
  "user",
  StaffRole.enum.admin,
  StaffRole.enum.support,
  StaffRole.enum.operations,
  StaffRole.enum.owner,
]);

export type AssignableUserRole = z.infer<typeof AssignableUserRole>;

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
