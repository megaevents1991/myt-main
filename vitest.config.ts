import { defineConfig } from "vitest/config";
import path from "node:path";

// `npm test` had never actually run: the script referenced vitest but the
// package was not a dependency. With it installed, vitest's default globs pick
// up two kinds of file it cannot execute, so both are excluded here:
//   - tests/**            Playwright specs, run by `npm run test:e2e`
//   - the legacy *.test.ts scripts below, which are plain ts-node validation
//     scripts with no describe/it blocks (see the header of each file)
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    exclude: [
      "node_modules/**",
      "tests/**",
      "lib/events/__tests__/price.test.ts",
      "lib/feed/__tests__/activitiesCatalog.test.ts",
      "lib/feed/__tests__/metaCatalog.test.ts",
      "lib/__tests__/eventNameMatch.test.ts",
      "lib/__tests__/taxonomy-tree.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
