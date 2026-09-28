"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { users } from "@/db/schema";
import { requireRole } from "@/core/auth";
import { withAudit } from "@/core/audit";
import { ROLES } from "@/core/rbac";

const updateRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(ROLES),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateUserRole(input: {
  userId: string;
  role: string;
}): Promise<ActionResult> {
  const actor = await requireRole("admin");

  const parsed = updateRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid role." };
  }
  const { userId, role } = parsed.data;

  if (userId === actor.id) {
    return { ok: false, error: "You cannot change your own role." };
  }

  const result = await db.transaction(async (tx) => {
    const before = await tx.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true, email: true, role: true },
    });

    if (!before) {
      return { ok: false as const, error: "User not found." };
    }
    if (before.role === role) {
      return { ok: true as const };
    }

    const [after] = await tx
      .update(users)
      .set({ role })
      .where(eq(users.id, userId))
      .returning({ id: users.id, email: users.email, role: users.role });

    await withAudit(tx, {
      actorId: actor.id,
      action: "user.role.updated",
      entity: "users",
      entityId: userId,
      before,
      after,
    });

    return { ok: true as const };
  });

  if (result.ok) {
    revalidatePath("/admin/users");
  }
  return result;
}
