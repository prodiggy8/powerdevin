"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { requireUser } from "@/core/auth";
import type { FormState } from "@/core/schema-form";
import { validateFormData } from "@/core/schema-form";
import {
  archiveFlag as archiveFlagService,
  createFlag as createFlagService,
  createFlagSchema,
  setFlagState as setFlagStateService,
  type MutationResult,
} from "./service";

export type FlagActionResult = MutationResult;

/** Creates a flag from the SchemaForm payload and redirects the form state. */
export async function createFlagAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const parsed = validateFormData(createFlagSchema, formData);
  if (!parsed.success) return parsed.state;

  const result = await createFlagService(
    db,
    { id: user.id, role: user.role },
    parsed.data,
  );

  if (!result.ok) {
    return {
      status: "error",
      message: result.error,
      fieldErrors: result.fieldErrors,
    };
  }

  revalidatePath("/flags");
  return { status: "success", message: `Flag ${parsed.data.key} created.` };
}

export async function setFlagState(input: {
  flagId: string;
  environment: string;
  enabled: boolean;
  rolloutPercent: number;
  reason?: string;
}): Promise<FlagActionResult> {
  const user = await requireUser();

  const result = await setFlagStateService(
    db,
    { id: user.id, role: user.role },
    input,
  );

  if (result.ok) {
    revalidatePath("/flags");
    revalidatePath(`/flags/${input.flagId}`);
  }
  return result;
}

export async function archiveFlag(flagId: string): Promise<FlagActionResult> {
  const user = await requireUser();

  const result = await archiveFlagService(
    db,
    { id: user.id, role: user.role },
    flagId,
  );

  if (result.ok) {
    revalidatePath("/flags");
    revalidatePath(`/flags/${flagId}`);
  }
  return result;
}
