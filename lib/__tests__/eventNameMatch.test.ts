// Pure tests for name normalization + fixture matching.
// Run: npx tsx lib/__tests__/eventNameMatch.test.ts
import {
  normalizeName,
  eventRelatesToTeam,
  eventBelongsToTeam,
} from "../eventNameMatch";

let failures = 0;
function expect(label: string, actual: unknown, want: unknown) {
  const ok = actual === want;
  if (!ok) {
    failures++;
    console.error(`FAIL ${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(want)}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

// --- normalizeName ---------------------------------------------------------
expect("accent stripped", normalizeName("André Rieu"), "andre rieu");
expect("trailing space trimmed", normalizeName("André Rieu "), "andre rieu");
expect("case folded", normalizeName("ANDRE RIEU"), "andre rieu");
expect("apostrophe dropped", normalizeName("Guns N' Roses"), "guns n roses");
expect("curly apostrophe dropped", normalizeName("Guns N’ Roses"), "guns n roses");
expect("comma+period dropped", normalizeName("St. Vincent, Live"), "st vincent live");
expect("hyphen KEPT (fixture separator)", normalizeName("Arsenal - Chelsea"), "arsenal - chelsea");
expect("inner whitespace collapsed", normalizeName("Andre   Rieu"), "andre rieu");
expect("hebrew untouched", normalizeName("אנדרה ריו"), "אנדרה ריו");
expect("null → empty", normalizeName(null), "");
expect("undefined → empty", normalizeName(undefined), "");

// The exact production bug (2026-07-21): backoffice-entered "Andre Rieu"
// events must land on the accented "André Rieu " template page.
const templateName = "André Rieu ";
const eventName = "Andre Rieu";
expect(
  "accented template matches plain event",
  normalizeName(eventName).includes(normalizeName(templateName)),
  true,
);

// --- fixture refinement still intact --------------------------------------
expect("team plays home", eventRelatesToTeam("AC Milan vs Napoli", "Milan"), true);
expect("team plays away", eventRelatesToTeam("Napoli vs AC Milan", "Milan"), true);
expect("other club's fixture excluded", eventRelatesToTeam("Inter Milan vs Napoli", "Milan"), false);
expect("artist event passes through", eventRelatesToTeam("Andre Rieu Budapest", "Andre Rieu"), true);
expect("away derby not team's art", eventBelongsToTeam("inter milan vs ac milan", "milan"), false);

if (failures) {
  console.error(`\n${failures} failing`);
  process.exit(1);
}
console.log("\nall passing");
