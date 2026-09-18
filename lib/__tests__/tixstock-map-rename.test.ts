/**
 * Validation script: a supplier renaming its categories must not grey out the
 * stadium map. Run with: npx tsx lib/__tests__/tixstock-map-rename.test.ts
 *
 * Regression: 2026-09-18. TixStock restyled the Bernabéu names inside its own
 * map file ("categoría-2-fondo") while our tickets keep the name they were
 * created with ("CATEGORÍA 2 (CAT2) - FONDO"). The map matcher compared exact
 * slugs, so all 19 Real Madrid home games rendered a fully grey, unclickable
 * map. The price side got a normalizer on 09-17 (lib/tixstock-category.ts);
 * the map side was the call site that was missed.
 */
import assert from "node:assert/strict";
import {
  categoryOnlyMatchesEl,
  isTicketMatchingCategory,
  isTicketMatchingSection,
  ticketCategoryMatchesEl,
  type TixStockMatchableListing,
} from "../tixstock-map";

const categoryOnly = (category: string): TixStockMatchableListing => ({
  id: category,
  seat_details: { category, section: category },
});
const sectioned = (category: string, section: string): TixStockMatchableListing => ({
  id: `${category}/${section}`,
  seat_details: { category, section },
});

// 1. THE REGRESSION - the five real ticket names against the real map ids.
const BERNABEU: [string, string][] = [
  ["CATEGORÍA 2 (CAT2) - FONDO", "categoría-2-fondo"],
  ["CATEGORÍA 2 (CAT2) - LATERAL", "categoría-2-lateral"],
  ["CATEGORÍA 3 (CAT3)", "categoría-3"],
  ["CATEGORÍA 1 (CAT1)", "categoría-1"],
  ["CATEGORIA 1 PREMIUM", "categoría-1-premium"],
];
for (const [name, mapCat] of BERNABEU) {
  const t = categoryOnly(name);
  assert.ok(categoryOnlyMatchesEl(t, `${mapCat}_134`, mapCat), `${name} paints ${mapCat}`);
  assert.ok(ticketCategoryMatchesEl(t, `${mapCat}_134`, mapCat), `${name} highlights ${mapCat}`);
  assert.ok(isTicketMatchingCategory(t, mapCat), `${name} is category ${mapCat}`);
}
console.log("✓ Renamed Bernabéu categories: every ticket finds its map category");

// 2. A renamed category never leaks into its siblings.
const fondo = categoryOnly("CATEGORÍA 2 (CAT2) - FONDO");
assert.equal(categoryOnlyMatchesEl(fondo, "categoría-2-lateral_501", "categoría-2-lateral"), false);
assert.equal(categoryOnlyMatchesEl(fondo, "categoría-1_128", "categoría-1"), false);
const cat1 = categoryOnly("CATEGORÍA 1 (CAT1)");
assert.equal(categoryOnlyMatchesEl(cat1, "categoría-1-premium_134", "categoría-1-premium"), false);
console.log("✓ Sibling categories stay apart (cat 1 vs cat 1 premium, fondo vs lateral)");

// 3. Existing strict behaviour is unchanged (the "fosse" guard).
const fosse = categoryOnly("Fosse");
assert.ok(categoryOnlyMatchesEl(fosse, "fosse", null));
assert.equal(categoryOnlyMatchesEl(fosse, "fosse-or-gauche", null), false);
assert.equal(categoryOnlyMatchesEl(fosse, "fosse-or-gauche_1", "fosse-or-gauche"), false);
console.log("✓ Exact-slug maps: unchanged, no prefix cross-highlight");

// 4. A sectioned live listing keeps its category guard through a rename.
const live = sectioned("Categoría 1 Premium", "134");
assert.ok(isTicketMatchingSection(live, "categoría-1-premium_134", "categoría-1-premium"));
const oldName = sectioned("CATEGORIA 1 PREMIUM", "134");
assert.ok(isTicketMatchingSection(oldName, "categoría-1-premium_134", "categoría-1-premium"));
assert.equal(isTicketMatchingSection(oldName, "categoría-1_134", "categoría-1"), false);
console.log("✓ Sectioned listings: right category only, renamed or not");

// 5. A name that normalizes to nothing matches nothing.
assert.equal(categoryOnlyMatchesEl(categoryOnly("(VIP)"), "---", "---"), false);
console.log("✓ Empty normalized name: no match");

console.log("\nAll tixstock-map rename checks passed.");
