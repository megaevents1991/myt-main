"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  submitCancellationRequest,
  type CancellationField,
  type CancellationFormState,
} from "@/lib/cancellation-request-actions";

const INITIAL: CancellationFormState = { status: "idle" };

const FIELDS: {
  name: CancellationField;
  label: string;
  type?: string;
  inputMode?: "numeric" | "tel" | "email";
  autoComplete?: string;
  dir?: "ltr";
}[] = [
  { name: "firstName", label: "שם פרטי", autoComplete: "given-name" },
  { name: "lastName", label: "שם משפחה", autoComplete: "family-name" },
  { name: "idNumber", label: "מספר תעודת זהות", inputMode: "numeric", dir: "ltr" },
  { name: "phone", label: "טלפון", type: "tel", inputMode: "tel", autoComplete: "tel", dir: "ltr" },
  { name: "orderNumber", label: "מספר הזמנה", dir: "ltr" },
  { name: "email", label: "דוא\"ל", type: "email", inputMode: "email", autoComplete: "email", dir: "ltr" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto sm:min-w-48">
      {pending ? "שולח..." : "שלח בקשה"}
    </Button>
  );
}

export function CancellationForm() {
  const [state, formAction] = useActionState(submitCancellationRequest, INITIAL);

  if (state.status === "success") {
    return (
      <div
        role="status"
        className="rounded-lg border border-green-500 bg-green-50 p-5 text-neutral-900 dark:bg-green-950/40 dark:text-green-50"
      >
        <p className="text-lg font-bold">הבקשה נשלחה בהצלחה</p>
        <p className="mt-2">{state.message}</p>
        {state.requestId ? (
          <p className="mt-2 text-sm">מספר פנייה לשמירה: <strong>{state.requestId}</strong></p>
        ) : null}
      </div>
    );
  }

  const v = state.values ?? {};
  const errors = state.errors ?? {};

  return (
    <form action={formAction} noValidate className="space-y-4">
      {state.status === "error" && state.message ? (
        <p role="alert" className="rounded-md border border-red-400 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-100">
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.name} className="space-y-1.5">
            <Label htmlFor={f.name}>{f.label}</Label>
            <Input
              id={f.name}
              name={f.name}
              type={f.type ?? "text"}
              inputMode={f.inputMode}
              autoComplete={f.autoComplete}
              dir={f.dir}
              defaultValue={v[f.name] ?? ""}
              required
              aria-invalid={Boolean(errors[f.name])}
              aria-describedby={errors[f.name] ? `${f.name}-error` : undefined}
              className={f.dir === "ltr" ? "text-left" : undefined}
            />
            {errors[f.name] ? (
              <p id={`${f.name}-error`} className="text-sm text-red-600 dark:text-red-300">
                {errors[f.name]}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note">בקשה / הערה</Label>
        <textarea
          id="note"
          name="note"
          rows={4}
          maxLength={2000}
          defaultValue={v.note ?? ""}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        {errors.note ? <p className="text-sm text-red-600 dark:text-red-300">{errors.note}</p> : null}
      </div>

      {/* Honeypot - hidden from people, filled by bots. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <SubmitButton />
    </form>
  );
}
