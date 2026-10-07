import { z } from "zod";
import { stateValues } from "../../shared/domain/states.generated";
export const authorityInput = z
  .object({
    authUserId: z.string().min(1).max(200),
    revision: z.number().int().nonnegative(),
    role: z.enum(stateValues.Role),
    status: z.enum(stateValues.AccountState),
  })
  .strict();
export const userQuery = z
  .object({
    search: z.string().trim().max(100).default(""),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    role: z.enum(stateValues.Role).optional(),
    status: z.enum(stateValues.AccountState).optional(),
  })
  .strict();
export type AuthorityInput = z.infer<typeof authorityInput>;
