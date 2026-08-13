import { describe, expect, it } from "vitest";
import { buildCustomLabels, type EventTaxonomyInfo } from "../feed/metaCatalog";

const tax = (over: Partial<EventTaxonomyInfo>): EventTaxonomyInfo => ({
  categoryPath: [],
  tagSlugs: [],
  tags: [],
  ...over,
});

describe("buildCustomLabels", () => {
  it("maps vertical/league/team/city/status to labels 0-4", () => {
    expect(
      buildCustomLabels(
        tax({
          tags: [
            { slug: "arsenal", type: "team" },
            { slug: "premier-league", type: "league" },
            { slug: "london", type: "city" },
            { slug: "football", type: "vertical" },
          ],
        }),
        "available",
        "LON",
      ),
    ).toEqual(["football", "premier-league", "arsenal", "london", "available"]);
  });

  it("prefers league over genre and team over artist", () => {
    expect(
      buildCustomLabels(
        tax({
          tags: [
            { slug: "rock", type: "genre" },
            { slug: "premier-league", type: "league" },
            { slug: "celine-dion", type: "artist" },
            { slug: "arsenal", type: "team" },
          ],
        }),
        "sold_out",
        null,
      ),
    ).toEqual(["", "premier-league", "arsenal", "", "sold_out"]);
  });

  it("falls back: vertical <- category path <- hint; city <- IATA lowercased", () => {
    expect(
      buildCustomLabels(tax({ categoryPath: ["Music", "Rock"] }), "available", "CDG"),
    ).toEqual(["music", "", "", "cdg", "available"]);
    expect(buildCustomLabels(tax({}), "available", null, "football-team")[0]).toBe(
      "football",
    );
    expect(buildCustomLabels(tax({}), "available", null, "artist")[0]).toBe("music");
  });

  it("drops legacy item-N slugs and picks alphabetically within a type", () => {
    expect(
      buildCustomLabels(
        tax({
          tags: [
            { slug: "item-4", type: "genre" },
            { slug: "pop", type: "genre" },
            { slug: "hip-hop", type: "genre" },
          ],
        }),
        "available",
        null,
      )[1],
    ).toBe("hip-hop");
  });
});
