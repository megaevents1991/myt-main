/**
 * "Build Your Euro Trip" - the summary's travellers form. Pure: no I/O, no React.
 *
 * The rules and the Hebrew words are the regular summary's (app/order/OrderReview.tsx with
 * `validate` from app/order/order-review.utils.ts, and `formatPhoneNumber` from
 * app/order/utils.ts) - REPEATED here, not imported: those files are live order code (one of
 * them loads the hotel provider), and this module is vitest-tested on its own. Change a rule
 * there, change it here.
 *
 * - The main contact: first and last name (English letters and spaces, 2 or more), an email,
 *   an Israeli mobile (starts with 05).
 * - Every other traveller: first and last name, same rule.
 * - To pay, every traveller's name is required. For the 24-hour hold only the main contact is;
 *   another traveller is checked only where something was typed.
 */
import isEmail from "validator/lib/isEmail";
import isMobilePhone from "validator/lib/isMobilePhone";
import type { OrderData } from "@/lib/app.types";

export type ContactInput = { firstName: string; lastName: string; phone: string; email: string };
export type OtherTraveller = { firstName: string; lastName: string };
export type TravellersInput = { contact: ContactInput; others: OtherTraveller[] };

export type ContactField = keyof ContactInput;
export type NameField = keyof OtherTraveller;

/** "pay": every traveller's name. "hold": the main contact only (the live 24-hour hold). */
export type TravellersMode = "pay" | "hold";

/** An error's key: `contact.<field>` or `others.<row>.<field>` (row 0 = the second traveller). */
export const contactKey = (field: ContactField): string => `contact.${field}`;
export const otherKey = (row: number, field: NameField): string => `others.${row}.${field}`;

const NAME_RE = /^[A-Za-z\s]+$/;

/** The live `validate` (app/order/order-review.utils.ts), field by field. "" = fine. */
export const validateField: Record<ContactField, (value: string) => string> = {
  firstName: (value) => {
    const v = value.trim();
    if (!v) return "שם פרטי הוא שדה חובה";
    if (v.length < 2) return "שם פרטי חייב להכיל 2 תווים ויותר";
    if (!NAME_RE.test(v)) return "שם פרטי חייב להיות באנגלית בלבד";
    return "";
  },
  lastName: (value) => {
    const v = value.trim();
    if (!v) return "שם משפחה הוא שדה חובה";
    if (v.length < 2) return "שם משפחה חייב להכיל 2 תווים ויותר";
    if (!NAME_RE.test(v)) return "שם משפחה חייב להיות באנגלית בלבד";
    return "";
  },
  email: (value) => {
    const v = value.trim();
    if (!v) return "אימייל הוא שדה חובה";
    if (!isEmail(v)) return "נא להזין כתובת אימייל תקינה";
    return "";
  },
  phone: (value) => {
    const clean = value.replace(/[- ]/g, "");
    if (!clean) return "טלפון נייד הוא שדה חובה";
    if (!clean.startsWith("05")) return "מספר נייד חייב להתחיל ב-05";
    if (!isMobilePhone(clean, "he-IL")) return "נא להזין מספר טלפון תקין";
    return "";
  },
};

const CONTACT_FIELDS: ContactField[] = ["firstName", "lastName", "email", "phone"];
const NAME_FIELDS: NameField[] = ["firstName", "lastName"];

const blankContact = (): ContactInput => ({ firstName: "", lastName: "", phone: "", email: "" });
const blankOther = (): OtherTraveller => ({ firstName: "", lastName: "" });

/** A form with nothing typed, for `pax` travellers. */
export function emptyTravellers(pax: number): TravellersInput {
  return { contact: blankContact(), others: Array.from({ length: Math.max(0, pax - 1) }, blankOther) };
}

/**
 * The form for `pax` travellers: the rows typed so far are kept, extra rows dropped, new rows
 * blank (the regular summary's `fitPassengers`). The same object back when it already fits.
 */
export function fitTravellers(t: TravellersInput, pax: number): TravellersInput {
  const n = Math.max(0, pax - 1);
  if (t.others.length === n) return t;
  return {
    contact: t.contact,
    others: Array.from({ length: n }, (_, i) => t.others[i] ?? blankOther()),
  };
}

/**
 * Every error of the form for `pax` travellers, by key (`contactKey` / `otherKey`). Empty = the
 * form may be sent. A row the form does not have yet counts as a blank row; rows beyond the
 * party are not the trip's travellers and are not checked.
 */
export function validateTravellers(t: TravellersInput, pax: number, mode: TravellersMode = "pay"): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of CONTACT_FIELDS) {
    const error = validateField[field](t.contact[field] ?? "");
    if (error) errors[contactKey(field)] = error;
  }
  for (let row = 0; row < Math.max(0, pax - 1); row++) {
    const other = t.others[row] ?? blankOther();
    for (const field of NAME_FIELDS) {
      const value = other[field] ?? "";
      // Hold: another traveller is optional - checked only where something was typed.
      if (mode === "hold" && !value.trim()) continue;
      const error = validateField[field](value);
      if (error) errors[otherKey(row, field)] = error;
    }
  }
  return errors;
}

export function isFormValid(t: TravellersInput, pax: number, mode: TravellersMode = "pay"): boolean {
  return Object.keys(validateTravellers(t, pax, mode)).length === 0;
}

/** The reservation's contact columns (`OrderData`, lib/app.types.ts) - what the live summary sends. */
export function toOrderContactFields(
  t: TravellersInput,
): Pick<
  OrderData,
  "main_contact_first_name" | "main_contact_last_name" | "main_contact_phone_number" | "main_contact_email" | "more_pax_info"
> {
  return {
    main_contact_first_name: t.contact.firstName.trim(),
    main_contact_last_name: t.contact.lastName.trim(),
    main_contact_phone_number: t.contact.phone.trim(),
    main_contact_email: t.contact.email.trim(),
    more_pax_info: t.others.map((o) => ({ first_name: o.firstName.trim(), last_name: o.lastName.trim() })),
  };
}

/** The live phone mask (`formatPhoneNumber`, app/order/utils.ts): digits only, "050-123-4567". */
export function formatPhone(value: string): string {
  const cleaned = value.replace(/\D/g, "");
  let formatted = cleaned;
  if (cleaned.length >= 3) formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  if (cleaned.length >= 6) formatted = `${formatted.slice(0, 7)}-${formatted.slice(7)}`;
  return formatted.slice(0, 12);
}
