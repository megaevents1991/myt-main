import { describe, expect, it } from "vitest";
import {
  SUGGEST_TITLE_MAX,
  cleanSuggestTitle,
  isMissingRequestsTable,
  parseSuggestion,
  suggestionRow,
} from "@/lib/itinerary/suggestion";

describe("cleanSuggestTitle", () => {
  it("trims and folds runs of spaces, tabs and newlines into one space", () => {
    expect(cleanSuggestTitle("  סופ״ש   פריז\t\n-  לונדון  ")).toBe("סופ״ש פריז - לונדון");
  });

  it("drops control and bidi-override characters", () => {
    expect(cleanSuggestTitle("פריז\u0000‮לונדון‏")).toBe("פריזלונדון");
  });

  it(`cuts to ${SUGGEST_TITLE_MAX} characters after cleaning`, () => {
    const long = "א".repeat(SUGGEST_TITLE_MAX + 20);
    expect(cleanSuggestTitle(long)).toHaveLength(SUGGEST_TITLE_MAX);
  });

  it("anything that is not a string is no title", () => {
    expect(cleanSuggestTitle(undefined)).toBe("");
    expect(cleanSuggestTitle(42)).toBe("");
    expect(cleanSuggestTitle(null)).toBe("");
  });
});

describe("parseSuggestion", () => {
  it("an object is an opt-in; its title is cleaned (empty = null, staff name it)", () => {
    expect(parseSuggestion({ title: "  טיול  הבנים " })).toEqual({ title: "טיול הבנים" });
    expect(parseSuggestion({ title: "   " })).toEqual({ title: null });
    expect(parseSuggestion({})).toEqual({ title: null });
  });

  it("no suggestion when the field is absent or not an object - never a reason to refuse the hold", () => {
    expect(parseSuggestion(undefined)).toBeNull();
    expect(parseSuggestion(null)).toBeNull();
    expect(parseSuggestion(true)).toBeNull();
    expect(parseSuggestion("x")).toBeNull();
    expect(parseSuggestion([{ title: "x" }])).toBeNull();
  });
});

describe("suggestionRow", () => {
  const sub = {
    group: "3f2b8c4e-1d2a-4b6c-9e8f-0a1b2c3d4e5f",
    pax: 2,
    travellers: {
      contact: { firstName: " Dana ", lastName: "Levi", email: "dana@example.com ", phone: " 0501234567" },
      others: [],
    },
    suggest: { title: "פריז ולונדון" },
  };

  it("the trip in trip order, the hold's group and first row, and the main contact", () => {
    expect(suggestionRow(sub, [30, 10, 20], [901, 902, 903])).toEqual({
      title: "פריז ולונדון",
      event_ids: [30, 10, 20],
      itinerary_group: sub.group,
      reservation_id: 901,
      pax: 2,
      contact_name: "Dana Levi",
      contact_email: "dana@example.com",
      contact_phone: "0501234567",
    });
  });

  it("null when the customer did not opt in", () => {
    expect(suggestionRow({ ...sub, suggest: null }, [1, 2], [5, 6])).toBeNull();
  });

  it("no row ids = no reservation link, the rest is kept", () => {
    expect(suggestionRow(sub, [1, 2], [])?.reservation_id).toBeNull();
  });

  it("an untitled suggestion keeps its title null", () => {
    expect(suggestionRow({ ...sub, suggest: { title: null } }, [1, 2], [5])?.title).toBeNull();
  });
});

describe("isMissingRequestsTable", () => {
  it("only the two no-such-table codes", () => {
    expect(isMissingRequestsTable({ code: "42P01" })).toBe(true);
    expect(isMissingRequestsTable({ code: "PGRST205" })).toBe(true);
    expect(isMissingRequestsTable({ code: "23505" })).toBe(false);
    expect(isMissingRequestsTable(null)).toBe(false);
  });
});
