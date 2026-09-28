"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { idleFormState, type FieldSpec, type FormState } from "./types";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

export type SchemaFormProps = {
  fields: FieldSpec[];
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel?: string;
  defaultValues?: Record<string, string | number | undefined>;
};

/** Renders a form from a field spec and reports server-side zod errors. */
export function SchemaForm({
  fields,
  action,
  submitLabel = "Save",
  defaultValues = {},
}: SchemaFormProps) {
  const [state, formAction] = useActionState(action, idleFormState);

  return (
    <form action={formAction} className="space-y-4">
      {fields.map((field) => {
        const errors = state.fieldErrors?.[field.name];
        return (
          <div key={field.name} className="space-y-1.5">
            <label htmlFor={field.name} className="text-sm font-medium">
              {field.label}
            </label>
            {field.type === "select" ? (
              <Select
                name={field.name}
                defaultValue={defaultValues[field.name]?.toString()}
              >
                <SelectTrigger id={field.name} className="w-full">
                  <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {field.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={field.name}
                name={field.name}
                type={field.type}
                required={field.required}
                placeholder={field.placeholder}
                defaultValue={defaultValues[field.name]?.toString()}
              />
            )}
            {field.description ? (
              <p className="text-xs text-muted-foreground">{field.description}</p>
            ) : null}
            {errors?.length ? (
              <p className="text-xs text-destructive">{errors[0]}</p>
            ) : null}
          </div>
        );
      })}

      {state.message ? (
        <p
          className={
            state.status === "error"
              ? "text-sm text-destructive"
              : "text-sm text-muted-foreground"
          }
        >
          {state.message}
        </p>
      ) : null}

      <SubmitButton label={submitLabel} />
    </form>
  );
}
