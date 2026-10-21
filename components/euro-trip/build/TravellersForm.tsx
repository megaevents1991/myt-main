"use client";

import type { ChangeEvent, Ref } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  contactKey,
  formatPhone,
  otherKey,
  type ContactField,
  type NameField,
  type TravellersInput,
} from "@/lib/itinerary/travellers";
import { cn } from "@/lib/utils";
import { PanelTitle } from "./parts";

const LABELS: Record<ContactField, string> = {
  firstName: "שם פרטי באנגלית",
  lastName: "שם משפחה באנגלית",
  email: "אימייל",
  phone: "טלפון נייד",
};

const INPUT_ATTRS: Record<ContactField, { type: string; autoComplete: string; name: string }> = {
  firstName: { type: "text", autoComplete: "given-name", name: "first-name" },
  lastName: { type: "text", autoComplete: "family-name", name: "last-name" },
  email: { type: "email", autoComplete: "email", name: "email" },
  phone: { type: "tel", autoComplete: "tel", name: "phone" },
};

/** An input id from an error key (`contact.firstName` -> `trip-pax-contact-firstName`). */
export const fieldId = (key: string): string => `trip-pax-${key.replace(/\./g, "-")}`;

/** One field: the live summary's label, input and error line (red border + role="alert"). */
function Field({
  errorKey,
  field,
  value,
  error,
  traveller,
  onChange,
  onBlur,
}: {
  errorKey: string;
  field: ContactField;
  value: string;
  /** Shown only once the field was left or the form was sent (the live rule). */
  error: string | undefined;
  traveller: number;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const id = fieldId(errorKey);
  const errorId = `${id}-error`;
  const attrs = INPUT_ATTRS[field];
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-sm font-medium">
        {LABELS[field]}
      </Label>
      <Input
        id={id}
        dir="rtl"
        type={attrs.type}
        name={attrs.name}
        autoComplete={attrs.autoComplete}
        placeholder={LABELS[field]}
        aria-label={`${LABELS[field]} לנוסע ${traveller}`}
        aria-required="true"
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        className={cn("h-11 text-start", error && "border-red-500 focus-visible:ring-red-500")}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      {error && (
        <p id={errorId} role="alert" className="m-0 text-sm text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * "Build Your Euro Trip" - the summary's travellers form: the regular summary's fields, labels,
 * phone mask and messages (app/order/OrderReview.tsx), one row per traveller - the first is the
 * main contact (name, email, mobile), every other one a name as in the passport. The values
 * live in the trip (ItineraryProvider), so they survive a visit to another step and a refresh;
 * the rules are `validateTravellers` (lib/itinerary/travellers.ts).
 */
export function TravellersForm({
  value,
  errors,
  touched,
  onChange,
  onTouch,
  formRef,
}: {
  /** Already fitted to the party (`fitTravellers`). */
  value: TravellersInput;
  errors: Record<string, string>;
  /** Error keys whose message may show (left once, or the form was sent). */
  touched: ReadonlySet<string>;
  onChange: (t: TravellersInput) => void;
  onTouch: (key: string) => void;
  formRef?: Ref<HTMLElement>;
}) {
  const shown = (key: string) => (touched.has(key) ? errors[key] : undefined);

  const setContact = (field: ContactField, raw: string) =>
    onChange({ ...value, contact: { ...value.contact, [field]: field === "phone" ? formatPhone(raw) : raw } });
  const setOther = (row: number, field: NameField, raw: string) =>
    onChange({ ...value, others: value.others.map((o, i) => (i === row ? { ...o, [field]: raw } : o)) });

  return (
    <section ref={formRef} aria-labelledby="trip-pax-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <PanelTitle>
          <span id="trip-pax-title">פרטי הנוסעים</span>
        </PanelTitle>
        <p className="m-0 text-sm text-muted-foreground">יש להזין שמות כפי שמופיעים בדרכון</p>
      </div>
      <form className="flex flex-col gap-5" dir="rtl" aria-labelledby="trip-pax-title" noValidate onSubmit={(e) => e.preventDefault()}>
        <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
          <legend className="mb-2 p-0 text-[15px] font-bold">נוסע 1 · איש הקשר</legend>
          <div className="grid grid-cols-2 gap-3">
            {(["firstName", "lastName"] as const).map((f) => (
              <Field
                key={f}
                errorKey={contactKey(f)}
                field={f}
                value={value.contact[f]}
                error={shown(contactKey(f))}
                traveller={1}
                onChange={(v) => setContact(f, v)}
                onBlur={() => onTouch(contactKey(f))}
              />
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["email", "phone"] as const).map((f) => (
              <Field
                key={f}
                errorKey={contactKey(f)}
                field={f}
                value={value.contact[f]}
                error={shown(contactKey(f))}
                traveller={1}
                onChange={(v) => setContact(f, v)}
                onBlur={() => onTouch(contactKey(f))}
              />
            ))}
          </div>
        </fieldset>
        {value.others.map((other, row) => (
          <div key={row} className="border-t border-border pt-4">
            <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
              <legend className="mb-2 p-0 text-[15px] font-bold">נוסע {row + 2}</legend>
              <div className="grid grid-cols-2 gap-3">
                {(["firstName", "lastName"] as const).map((f) => (
                  <Field
                    key={f}
                    errorKey={otherKey(row, f)}
                    field={f}
                    value={other[f]}
                    error={shown(otherKey(row, f))}
                    traveller={row + 2}
                    onChange={(v) => setOther(row, f, v)}
                    onBlur={() => onTouch(otherKey(row, f))}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        ))}
      </form>
    </section>
  );
}
