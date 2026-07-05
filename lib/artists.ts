import { makePeopleReaders } from "@/lib/cms/people";

const r = makePeopleReaders({
  table: "artists",
  contentType: "artistTemplate",
  carouselId: "3RxzAgWZi26FSbBYhgMmVO",
});

/** All artists (catalog). */
export const getAllArtists = r.listAll;
/** Featured artists in carousel order (was the Contentful artist carousel). */
export const getFeaturedArtists = r.listFeatured;
export const getArtistBySlug = r.getBySlug;
export const getArtistSlugs = r.listSlugs;
