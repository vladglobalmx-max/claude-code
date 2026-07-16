import { z } from "zod";

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

export const followupSchema = z.object({
  contactMethod: z.enum(["EMAIL", "PHONE", "WHATSAPP", "IN_PERSON", "OTHER"]),
  nextFollowupAt: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : new Date(value))),
  closeProbabilityPct: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : Number(value)))
    .refine((value) => value === null || (!Number.isNaN(value) && value >= 0 && value <= 100), {
      message: "Debe ser un porcentaje entre 0 y 100",
    }),
  competitor: optionalTrimmed(120),
  objection: optionalTrimmed(500),
  comments: optionalTrimmed(1000),
});

export type FollowupFormValues = z.infer<typeof followupSchema>;
