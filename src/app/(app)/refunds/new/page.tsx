import { requireRole } from "@/core/auth";
import { SchemaForm, type FieldSpec } from "@/core/schema-form";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { createRefundFromForm } from "@/modules/refunds/actions";
import {
  REASON_LABELS,
  REFUND_REASONS,
  REFUND_THRESHOLD,
  formatMoney,
} from "@/modules/refunds/rules";

const FIELDS: FieldSpec[] = [
  { name: "orderRef", label: "Order reference", type: "text", required: true, placeholder: "ORD-10492" },
  { name: "customerName", label: "Customer name", type: "text", required: true },
  { name: "customerEmail", label: "Customer email", type: "email", required: true },
  {
    name: "amount",
    label: "Amount",
    type: "text",
    required: true,
    placeholder: "125.00",
    description: `At or above ${formatMoney(REFUND_THRESHOLD)} the refund is routed to an approver.`,
  },
  { name: "currency", label: "Currency", type: "text", placeholder: "USD" },
  {
    name: "reason",
    label: "Reason",
    type: "select",
    required: true,
    options: REFUND_REASONS.map((reason) => ({
      label: REASON_LABELS[reason],
      value: reason,
    })),
  },
  { name: "note", label: "Note", type: "text", placeholder: "Context for the reviewer" },
];

export default async function NewRefundPage() {
  await requireRole("analyst");

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="New refund"
        description="Below the threshold an analyst can decide it directly; at or above it an approval request is opened."
      />
      <Card className="max-w-xl shadow-none">
        <CardContent>
          <SchemaForm
            fields={FIELDS}
            action={createRefundFromForm}
            submitLabel="Submit refund"
            defaultValues={{ currency: "USD" }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
