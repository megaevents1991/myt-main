"use client";

// The identity details TixStock asks for at an ITALIAN venue, one block per traveller, on the summary of a TixStock
// sandbox test event only (`OrderReview` renders it behind `sandboxSummaryState(...).italian`). A real event's
// summary never mounts it.
//
// The values live in `OrderReview`'s own state and travel only in the pay request. They are never written to
// `sessionStorage` (a passport number must not sit in the browser's storage), and the inputs carry no
// `data-mp-allow`, so the session recorder keeps them masked.
import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { nationalityOptions } from "@/lib/tixstock-booking/nationalities";
import { attendeeIssues, type AttendeeInput, type AttendeeIssue } from "@/lib/tixstock-booking/rules";
import { attendeesForRequest } from "@/lib/tixstock-booking/summary";

const ERROR_TEXT: Record<Exclude<AttendeeIssue, "name">, string> = {
  passport: "יש להזין מספר דרכון",
  nationality: "יש לבחור אזרחות",
  dob: "יש להזין תאריך לידה תקין",
  gender: "יש לבחור מין",
  birth_place: "יש להזין מקום לידה",
};

const SELECT_CLASS =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-right text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50";

export function AttendeeFields({
  index,
  value,
  onChange,
  showErrors,
  disabled = false,
}: {
  /** The traveller's row in the summary's form (0 = the main contact). */
  index: number;
  value: Partial<AttendeeInput>;
  onChange: (next: Partial<AttendeeInput>) => void;
  /** True once the customer pressed pay: the missing details are named. */
  showErrors: boolean;
  disabled?: boolean;
}) {
  const options = useMemo(() => nationalityOptions(), []);

  // Judged exactly as it will be sent: the same shaping and the same rule the pay click and `confirm-order` use.
  // The name is the summary's own field - a placeholder keeps it out of this block's issues.
  const issues = new Set<AttendeeIssue>(
    attendeeIssues(attendeesForRequest([{ firstName: "x", lastName: "x" }], [value], true)[0], true),
  );
  const errorOf = (field: Exclude<AttendeeIssue, "name">): string | null =>
    showErrors && issues.has(field) ? ERROR_TEXT[field] : null;

  const field = (
    name: Exclude<AttendeeIssue, "name">,
    label: string,
    control: (id: string, invalid: boolean, describedBy: string | undefined) => React.ReactNode,
  ) => {
    const id = `attendee-${name}-${index}`;
    const error = errorOf(name);
    return (
      <div className="space-y-1">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        {control(id, !!error, error ? `${id}-error` : undefined)}
        {error && (
          <p id={`${id}-error`} className="text-right text-xs text-red-500" role="alert" aria-live="polite">
            {error}
          </p>
        )}
      </div>
    );
  };

  return (
    <fieldset className="space-y-3 rounded-md border border-border p-3" data-attendee-fields={index}>
      <legend className="px-1 text-sm font-medium">האירוע דורש פרטי זיהוי</legend>
      <div className="grid grid-cols-2 gap-4">
        {field("passport", "מספר דרכון", (id, invalid, describedBy) => (
          <Input
            id={id}
            dir="ltr"
            type="text"
            autoComplete="off"
            value={value.passport ?? ""}
            disabled={disabled}
            aria-required="true"
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={cn("h-11 text-right", invalid && "border-red-500")}
            onChange={(e) => onChange({ ...value, passport: e.target.value })}
          />
        ))}
        {field("nationality", "אזרחות", (id, invalid, describedBy) => (
          <select
            id={id}
            value={value.nationality ?? ""}
            disabled={disabled}
            aria-required="true"
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={cn(SELECT_CLASS, invalid && "border-red-500")}
            onChange={(e) => onChange({ ...value, nationality: e.target.value })}
          >
            <option value="">בחרו מדינה</option>
            {options.map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
          </select>
        ))}
        {field("dob", "תאריך לידה", (id, invalid, describedBy) => (
          <Input
            id={id}
            dir="ltr"
            type="date"
            autoComplete="off"
            value={value.dob ?? ""}
            disabled={disabled}
            aria-required="true"
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={cn("h-11 text-right", invalid && "border-red-500")}
            onChange={(e) => onChange({ ...value, dob: e.target.value })}
          />
        ))}
        {field("gender", "מין", (id, invalid, describedBy) => (
          <select
            id={id}
            value={value.gender ?? ""}
            disabled={disabled}
            aria-required="true"
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={cn(SELECT_CLASS, invalid && "border-red-500")}
            onChange={(e) =>
              onChange({ ...value, gender: e.target.value === "M" || e.target.value === "F" ? e.target.value : undefined })
            }
          >
            <option value="">בחרו</option>
            <option value="M">זכר</option>
            <option value="F">נקבה</option>
          </select>
        ))}
      </div>
      {field("birth_place", "מקום לידה (עיר, באנגלית)", (id, invalid, describedBy) => (
        <Input
          id={id}
          dir="ltr"
          type="text"
          autoComplete="off"
          value={value.birth_place ?? ""}
          disabled={disabled}
          aria-required="true"
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className={cn("h-11 text-right", invalid && "border-red-500")}
          onChange={(e) => onChange({ ...value, birth_place: e.target.value })}
        />
      ))}
    </fieldset>
  );
}
