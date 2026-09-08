// Pure tests for name normalization + fixture matching.
// Run: npx tsx lib/__tests__/eventNameMatch.test.ts
import {
  normalizeName,
  eventRelatesToTeam,
  eventBelongsToTeam,
  teamFixtureRole,
  fixturePair,
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

// --- TixStock "A vs B - Competition" names --------------------------------
// The TixStock feed names fixtures "Home vs Away - Competition [season]".
// The competition tail must not be read as a third side / part of the away club.
expect(
  "fixturePair: english competition suffix dropped",
  JSON.stringify(fixturePair("As Roma Vs Real Madrid Cf - Champions League ")),
  JSON.stringify(["As Roma", "Real Madrid Cf"]),
);
expect(
  "fixturePair: season year in suffix dropped",
  JSON.stringify(fixturePair("Borussia Dortmund vs AEK Athens - Champions League 2026-2027")),
  JSON.stringify(["Borussia Dortmund", "AEK Athens"]),
);
expect(
  "fixturePair: hebrew prefix + dash",
  JSON.stringify(fixturePair("ליגת האלופות: א.ס רומא - ריאל מדריד")),
  JSON.stringify(["א.ס רומא", "ריאל מדריד"]),
);
expect(
  "fixturePair: plain vs",
  JSON.stringify(fixturePair("Manchester United FC vs Manchester City FC")),
  JSON.stringify(["Manchester United FC", "Manchester City FC"]),
);
expect(
  "fixturePair: en-dash separator",
  JSON.stringify(fixturePair("Real Betis – Borussia Dortmund")),
  JSON.stringify(["Real Betis", "Borussia Dortmund"]),
);
expect("fixturePair: artist name is not a fixture", fixturePair("Andre Rieu Budapest"), null);
expect("fixturePair: three dash parts is not a fixture", fixturePair("A - B - C"), null);
expect("fixturePair: null-safe", fixturePair(null), null);
expect(
  "role: away side with competition suffix",
  teamFixtureRole("manchester united vs as roma - champions league", "as roma"),
  "away",
);
expect(
  "role: qualifier drift home side",
  teamFixtureRole("manchester united vs as roma - champions league", "manchester united fc"),
  "home",
);
expect(
  "belongs: away club with competition suffix",
  eventBelongsToTeam("aek athens vs real madrid - champions league", "real madrid"),
  true,
);

if (failures) {
  console.error(`\n${failures} failing`);
  process.exit(1);
}
console.log("\nall passing");
