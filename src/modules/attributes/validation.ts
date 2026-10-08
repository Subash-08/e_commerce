import { z } from "zod";
import { stateValues } from "../../shared/domain/states.generated";

export const objectId = z
  .string()
  .regex(/^[a-f0-9]{24}$/, "Choose a valid record.");
export const attributeInput = z
  .object({
    id: objectId.optional(),
    revision: z.number().int().nonnegative().optional(),
    code: z
      .string()
      .trim()
      .min(1)
      .max(60)
      .regex(/^[a-z][a-z0-9_]*$/),
    name: z.string().trim().min(1).max(100),
    type: z.enum(stateValues.AttributeType),
    unit: z.string().trim().max(20),
    visible: z.boolean(),
    filterable: z.boolean(),
    variantAxisAllowed: z.boolean(),
    active: z.boolean(),
    displayOrder: z.number().int().min(0).max(100000),
    options: z
      .array(
        z
          .object({
            id: objectId,
            label: z.string().trim().min(1).max(100),
            colour: z
              .string()
              .regex(/^#[0-9a-fA-F]{6}$/)
              .or(z.literal("")),
            active: z.boolean(),
          })
          .strict(),
      )
      .max(100),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.id && value.revision === undefined)
      ctx.addIssue({
        code: "custom",
        path: ["revision"],
        message: "Reload before editing.",
      });
    const selectable = ["SINGLE_SELECT", "MULTI_SELECT", "COLOUR"].includes(
      value.type,
    );
    if (
      value.variantAxisAllowed &&
      !["SINGLE_SELECT", "COLOUR"].includes(value.type)
    )
      ctx.addIssue({
        code: "custom",
        path: ["type"],
        message: "Variant axes must be single-select or colour.",
      });
    if (!selectable && value.options.length)
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "This type does not use options.",
      });
    if (
      new Set(value.options.map((o) => o.id)).size !== value.options.length ||
      new Set(value.options.map((o) => o.label.normalize("NFKC").toLowerCase()))
        .size !== value.options.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Options must have unique identities and labels.",
      });
    if (value.type === "COLOUR" && value.options.some((o) => !o.colour))
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Choose a swatch colour for each option.",
      });
  });
export type AttributeInput = z.infer<typeof attributeInput>;
