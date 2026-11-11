// The nationality list of the Italian attendee form (app/order/sandbox/AttendeeFields.tsx - TixStock test events
// only): TixStock takes `nationality` as an ISO 3166-1 alpha-2 country code. The Hebrew names come from the
// runtime's own `Intl.DisplayNames`, so no country table is kept here.
// Test: lib/__tests__/tixstockSummary.test.ts.

/** ISO 3166-1 alpha-2, the officially assigned codes. */
export const NATIONALITY_CODES: readonly string[] = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO " +
  "FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE " +
  "JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO " +
  "MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW " +
  "PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM " +
  "TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
).split(" ");

/** The options of the nationality `<select>`: Israel first, then by Hebrew name. A code with no name shows itself. */
export function nationalityOptions(): Array<{ code: string; label: string }> {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames(["he"], { type: "region" });
  } catch {
    names = null;
  }
  const options = NATIONALITY_CODES.map((code) => ({ code, label: names?.of(code) ?? code }));
  return options.sort((a, b) => (a.code === "IL" ? -1 : b.code === "IL" ? 1 : a.label.localeCompare(b.label, "he")));
}
