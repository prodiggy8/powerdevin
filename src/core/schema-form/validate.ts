import { z } from "zod";
import type { FormState } from "./types";

export type Validated<T> =
  | { success: true; data: T }
  | { success: false; state: FormState };

/** Parses a FormData payload with a zod schema into a FormState on failure. */
export function validateFormData<T extends z.ZodType>(
  schema: T,
  formData: FormData,
): Validated<z.infer<T>> {
  const result = schema.safeParse(Object.fromEntries(formData.entries()));
  if (result.success) {
    return { success: true, data: result.data };
  }
  const flattened = z.flattenError(result.error);
  return {
    success: false,
    state: {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: flattened.fieldErrors as Record<string, string[]>,
    },
  };
}
