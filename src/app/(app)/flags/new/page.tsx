import { redirect } from "next/navigation";

import { requireUser } from "@/core/auth";
import { SchemaForm, type FieldSpec } from "@/core/schema-form";
import { PageHeader } from "@/components/page-header";
import { createFlagAction } from "@/modules/flags/actions";
import { canCreateFlag } from "@/modules/flags/policy";
import { listFlagOwners } from "@/modules/flags/queries";

export default async function NewFlagPage() {
  const user = await requireUser();
  if (!canCreateFlag(user.role)) {
    redirect("/forbidden");
  }

  const owners = await listFlagOwners();
  const options = owners.map((owner) => ({
    label: owner.name ?? owner.email ?? owner.id,
    value: owner.id,
  }));
  const defaultOwnerId = options.some((option) => option.value === user.id)
    ? user.id
    : options[0]?.value;

  const fields: FieldSpec[] = [
    {
      name: "key",
      label: "Key",
      type: "text",
      required: true,
      placeholder: "instant_refunds_v2",
      description: "Lowercase snake_case. It cannot be changed later.",
    },
    {
      name: "description",
      label: "Description",
      type: "text",
      required: true,
      placeholder: "What this flag turns on.",
    },
    {
      name: "ownerId",
      label: "Owner",
      type: "select",
      required: true,
      options,
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="New feature flag"
        description="The flag starts disabled at 0% in dev, staging and prod."
      />
      <div className="max-w-lg">
        <SchemaForm
          fields={fields}
          action={createFlagAction}
          submitLabel="Create flag"
          defaultValues={{ ownerId: defaultOwnerId }}
        />
      </div>
    </div>
  );
}
