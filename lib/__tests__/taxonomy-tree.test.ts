/**
 * Validation script for the taxonomy tree helpers (buildTree, descendantIds,
 * ancestorsOf, slugPathOf, flattenWithPath).
 * Run with: npx tsx lib/__tests__/taxonomy-tree.test.ts
 * (Matches the repo's script-style tests — see lib/events/__tests__/price.test.ts.)
 */
import assert from "node:assert";
import {
  buildTree,
  descendantIds,
  ancestorsOf,
  slugPathOf,
  flattenWithPath,
} from "../taxonomy-tree";
import type { EventCategory } from "../taxonomy.types";

const cat = (
  id: number,
  name: string,
  slug: string,
  parent_id: number | null,
  display_order = 0
): EventCategory => ({
  id,
  parent_id,
  slug,
  name,
  name_english: null,
  image_url: null,
  description: null,
  display_order,
  is_active: true,
  is_deleted: false,
  created_at: "",
  updated_at: "",
});

// כדורגל(1) ├─ ליגה אנגלית(2) ─ דרבי(4)   מוזיקה(3) ─ פופ(5)
const CATS: EventCategory[] = [
  cat(1, "כדורגל", "football", null, 0),
  cat(2, "ליגה אנגלית", "premier-league", 1),
  cat(3, "מוזיקה", "music", null, 1),
  cat(4, "דרבי", "derby", 2),
  cat(5, "פופ", "pop", 3),
];

// buildTree: nesting + root order
const tree = buildTree(CATS);
assert.deepStrictEqual(
  tree.map((n) => n.slug),
  ["football", "music"],
  "roots sorted by display_order"
);
assert.strictEqual(tree[0].children[0].slug, "premier-league", "child nested");
assert.strictEqual(tree[0].children[0].children[0].slug, "derby", "grandchild nested");

// buildTree: orphan (missing parent) becomes a root
assert.deepStrictEqual(
  buildTree([cat(9, "יתום", "orphan", 999)]).map((n) => n.slug),
  ["orphan"],
  "orphan treated as root"
);

// descendantIds: whole subtree, excluding the node itself
assert.deepStrictEqual(descendantIds(tree, 1).sort(), [2, 4], "football subtree");
assert.deepStrictEqual(descendantIds(tree, 2), [4], "league subtree");
assert.deepStrictEqual(descendantIds(tree, 4), [], "leaf has no descendants");

// ancestorsOf / slugPathOf: root-first walk up
const derby = CATS.find((c) => c.id === 4)!;
assert.deepStrictEqual(
  ancestorsOf(derby, CATS).map((a) => a.slug),
  ["football", "premier-league"],
  "ancestors root-first"
);
assert.deepStrictEqual(
  slugPathOf(derby, CATS),
  ["football", "premier-league", "derby"],
  "canonical slug path"
);
const football = CATS.find((c) => c.id === 1)!;
assert.deepStrictEqual(ancestorsOf(football, CATS), [], "root has no ancestors");
assert.deepStrictEqual(slugPathOf(football, CATS), ["football"], "root path is own slug");

// corrupt parent cycle must not hang or throw
const a = cat(1, "א", "a", 2);
const b = cat(2, "ב", "b", 1);
ancestorsOf(a, [a, b]);

// flattenWithPath: full path labels
const paths = flattenWithPath(CATS);
assert.strictEqual(
  paths.find((p) => p.id === 4)?.path,
  "כדורגל › ליגה אנגלית › דרבי",
  "nested path label"
);
assert.strictEqual(paths.find((p) => p.id === 1)?.path, "כדורגל", "root path label");

console.log("taxonomy-tree: all assertions passed ✅");
