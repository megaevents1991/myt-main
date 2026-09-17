/**
 * Comparable form of a TixStock category name.
 *
 * Our `tickets_and_rates[].category` is a copy of TixStock's category name taken
 * when the event was set up; live listings carry the name as it is TODAY. When
 * TixStock restyles a venue's names the two drift apart - the Bernabéu went from
 * "CATEGORÍA 2 (CAT2) - FONDO" to "Categoría 2 Fondo" and every Real Madrid
 * home game showed "sold out" with 23 live listings on sale (2026-09-17),
 * because the match was an exact lowercase compare.
 *
 * Drops accents, parenthesised codes and punctuation, collapses whitespace:
 * both of the names above become "categoria 2 fondo".
 */
export function normalizeTxCategory(
  category: string | undefined | null,
): string {
  return (category ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
