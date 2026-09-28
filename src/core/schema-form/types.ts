export type FieldSpec =
  | {
      name: string;
      label: string;
      type: "text" | "email" | "number" | "date";
      placeholder?: string;
      required?: boolean;
      description?: string;
    }
  | {
      name: string;
      label: string;
      type: "select";
      options: { label: string; value: string }[];
      required?: boolean;
      description?: string;
    };

export type FormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export const idleFormState: FormState = { status: "idle" };
