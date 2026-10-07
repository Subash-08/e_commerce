import { z } from "zod";

const id = z.string().regex(/^[a-f0-9]{24}$/);

export const brandInput = z
  .object({
    id: id.optional(),
    revision: z.number().int().nonnegative().optional(),
    name: z.string().trim().min(1).max(120),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    description: z.string().trim().max(5000).default(""),
    active: z.boolean(),
    featured: z.boolean().default(false),
    archived: z.boolean().default(false),
    deactivationReason: z.string().trim().max(300).default(""),
    displayOrder: z.number().int().min(0).max(100000),
    logoId: id.nullable().default(null),
    seo: z
      .object({
        title: z.string().trim().max(70),
        description: z.string().trim().max(170),
        canonicalPath: z
          .string()
          .max(200)
          .refine(
            (value) =>
              value === "" ||
              (value.startsWith("/brand/") &&
                /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slice(7))),
          ),
        robotsIndex: z.boolean(),
        robotsFollow: z.boolean(),
      })
      .strict(),
  })
  .strict()
  .refine((value) => !value.id || value.revision !== undefined, {
    message: "Refresh this brand before editing.",
    path: ["revision"],
  })
  .refine((value) => value.active || value.deactivationReason.length > 0, {
    message: "Explain why this brand is inactive.",
    path: ["deactivationReason"],
  });

export type BrandInput = z.infer<typeof brandInput>;

export function brandSlug(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}
