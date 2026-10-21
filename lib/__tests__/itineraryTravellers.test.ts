import { describe, expect, it } from "vitest";
import {
  emptyTravellers,
  fitTravellers,
  formatPhone,
  isFormValid,
  toOrderContactFields,
  validateTravellers,
  type TravellersInput,
} from "../itinerary/travellers";

const contact = { firstName: "Dana", lastName: "Levi", phone: "050-123-4567", email: "dana@example.com" };
const filled = (others: { firstName: string; lastName: string }[]): TravellersInput => ({ contact, others });
const two = filled([{ firstName: "Avi", lastName: "Cohen" }]);

describe("validateTravellers - the regular summary's rules and words", () => {
  it("a whole form has no errors", () => {
    expect(validateTravellers(two, 2)).toEqual({});
    expect(isFormValid(two, 2)).toBe(true);
  });

  it("a name in Hebrew: names are typed as in the passport, in English", () => {
    const e = validateTravellers({ ...two, contact: { ...contact, firstName: "דנה" } }, 2);
    expect(e).toEqual({ "contact.firstName": "שם פרטי חייב להיות באנגלית בלבד" });
    const other = validateTravellers(filled([{ firstName: "Avi", lastName: "כהן" }]), 2);
    expect(other).toEqual({ "others.0.lastName": "שם משפחה חייב להיות באנגלית בלבד" });
  });

  it("a short name, an empty one", () => {
    const e = validateTravellers({ ...two, contact: { ...contact, firstName: "D", lastName: "  " } }, 2);
    expect(e["contact.firstName"]).toBe("שם פרטי חייב להכיל 2 תווים ויותר");
    expect(e["contact.lastName"]).toBe("שם משפחה הוא שדה חובה");
  });

  it("a bad email", () => {
    expect(validateTravellers({ ...two, contact: { ...contact, email: "dana@" } }, 2)).toEqual({
      "contact.email": "נא להזין כתובת אימייל תקינה",
    });
    expect(validateTravellers({ ...two, contact: { ...contact, email: "" } }, 2)).toEqual({
      "contact.email": "אימייל הוא שדה חובה",
    });
  });

  it("a phone that is not an Israeli mobile", () => {
    expect(validateTravellers({ ...two, contact: { ...contact, phone: "03-768-4800" } }, 2)).toEqual({
      "contact.phone": "מספר נייד חייב להתחיל ב-05",
    });
    expect(validateTravellers({ ...two, contact: { ...contact, phone: "" } }, 2)).toEqual({
      "contact.phone": "טלפון נייד הוא שדה חובה",
    });
    expect(validateTravellers({ ...two, contact: { ...contact, phone: "05-1" } }, 2)).toEqual({
      "contact.phone": "נא להזין מספר טלפון תקין",
    });
  });

  it("a missing traveller row: every traveller's name is required to pay", () => {
    expect(validateTravellers(two, 3)).toEqual({
      "others.1.firstName": "שם פרטי הוא שדה חובה",
      "others.1.lastName": "שם משפחה הוא שדה חובה",
    });
    expect(validateTravellers(filled([]), 2)).toEqual({
      "others.0.firstName": "שם פרטי הוא שדה חובה",
      "others.0.lastName": "שם משפחה הוא שדה חובה",
    });
    expect(isFormValid(two, 3)).toBe(false);
  });

  it("the 24-hour hold asks only for the main contact; another traveller is checked only where typed", () => {
    expect(validateTravellers(filled([]), 3, "hold")).toEqual({});
    expect(validateTravellers(filled([{ firstName: "", lastName: "" }]), 2, "hold")).toEqual({});
    expect(validateTravellers(filled([{ firstName: "אבי", lastName: "" }]), 2, "hold")).toEqual({
      "others.0.firstName": "שם פרטי חייב להיות באנגלית בלבד",
    });
    expect(validateTravellers({ contact: { ...contact, email: "" }, others: [] }, 2, "hold")).toEqual({
      "contact.email": "אימייל הוא שדה חובה",
    });
  });

  it("rows beyond the party are not the trip's travellers", () => {
    const extra = filled([
      { firstName: "Avi", lastName: "Cohen" },
      { firstName: "בלי", lastName: "" },
    ]);
    expect(validateTravellers(extra, 2)).toEqual({});
  });
});

describe("fitTravellers - the form follows the party", () => {
  it("keeps the rows typed so far, drops the extra ones and adds blank ones", () => {
    const three = filled([
      { firstName: "Avi", lastName: "Cohen" },
      { firstName: "Noa", lastName: "Bar" },
    ]);
    expect(fitTravellers(three, 2).others).toEqual([{ firstName: "Avi", lastName: "Cohen" }]);
    expect(fitTravellers(two, 3).others).toEqual([
      { firstName: "Avi", lastName: "Cohen" },
      { firstName: "", lastName: "" },
    ]);
    expect(fitTravellers(two, 1).others).toEqual([]);
    expect(fitTravellers(two, 3).contact).toEqual(contact);
  });

  it("an empty form for the party", () => {
    expect(emptyTravellers(3)).toEqual({
      contact: { firstName: "", lastName: "", phone: "", email: "" },
      others: [
        { firstName: "", lastName: "" },
        { firstName: "", lastName: "" },
      ],
    });
  });
});

describe("toOrderContactFields - the reservation's contact columns (OrderData)", () => {
  it("the main contact and every other traveller, trimmed", () => {
    expect(
      toOrderContactFields({
        contact: { firstName: " Dana ", lastName: "Levi", phone: "050-123-4567", email: " dana@example.com" },
        others: [{ firstName: "Avi ", lastName: "Cohen" }],
      }),
    ).toEqual({
      main_contact_first_name: "Dana",
      main_contact_last_name: "Levi",
      main_contact_phone_number: "050-123-4567",
      main_contact_email: "dana@example.com",
      more_pax_info: [{ first_name: "Avi", last_name: "Cohen" }],
    });
  });
});

describe("formatPhone - the regular summary's phone mask", () => {
  it("050-123-4567, digits only, ten at most", () => {
    expect(formatPhone("0501234567")).toBe("050-123-4567");
    expect(formatPhone("050 12")).toBe("050-12");
    expect(formatPhone("05")).toBe("05");
    expect(formatPhone("050-123-45678")).toBe("050-123-4567");
  });
});
