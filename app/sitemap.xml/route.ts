import { getCachedEvents } from "@/lib/eventsData";
import { getArtistSlugs } from "@/lib/artists";
import { getFootballTeamSlugs } from "@/lib/football";

export async function GET() {
  try {
    const events = await getCachedEvents();
    const baseUrl = "https://www.mega-events.co.il";
    // Stable date for static pages — bump manually on meaningful content changes.
    // A per-request `new Date()` made every lastmod fake, so Google ignored them all.
    const STATIC_LASTMOD = "2026-07-01T00:00:00.000Z";
    const staticPages = [
      {
        url: baseUrl,
        lastModified: STATIC_LASTMOD,
        changeFrequency: "daily",
        priority: 1.0,
      },
      {
        url: `${baseUrl}/about`,
        lastModified: STATIC_LASTMOD,
        changeFrequency: "monthly",
        priority: 0.8,
      },
      {
        url: `${baseUrl}/faq`,
        lastModified: STATIC_LASTMOD,
        changeFrequency: "monthly",
        priority: 0.8,
      },
      {
        url: `${baseUrl}/artists`,
        lastModified: STATIC_LASTMOD,
        changeFrequency: "weekly",
        priority: 0.8,
      },
      {
        url: `${baseUrl}/football`,
        lastModified: STATIC_LASTMOD,
        changeFrequency: "weekly",
        priority: 0.8,
      },
      {
        url: `${baseUrl}/terms`,
        lastModified: STATIC_LASTMOD,
        changeFrequency: "monthly",
        priority: 0.3,
      },
      {
        url: `${baseUrl}/cancellation`,
        lastModified: STATIC_LASTMOD,
        changeFrequency: "monthly",
        priority: 0.3,
      },
    ];
    const eventPages = events.events.map((event) => ({
      url: `${baseUrl}/order/${event.id}`,
      // Real signal: row creation time (rows come from select("*")).
      lastModified:
        (event as { created_at?: string }).created_at ?? STATIC_LASTMOD,
      changeFrequency: "daily",
      priority: 0.9,
    }));

    // Fetch artists from Contentful with error handling
    let artistPages: Array<{
      url: string;
      lastModified: string;
      changeFrequency: string;
      priority: number;
    }> = [];
    try {
      const slugs = await getArtistSlugs();
      artistPages = slugs.map((slug) => ({
        url: `${baseUrl}/artists/${slug}`,
        lastModified: STATIC_LASTMOD,
        changeFrequency: "weekly",
        priority: 0.8,
      }));
    } catch (error) {
      console.error("Error fetching artists for sitemap:", error);
    }

    // Fetch football teams from Contentful with error handling
    let footballPages: Array<{
      url: string;
      lastModified: string;
      changeFrequency: string;
      priority: number;
    }> = [];
    try {
      const slugs = await getFootballTeamSlugs();
      footballPages = slugs.map((slug) => ({
        url: `${baseUrl}/football/${slug}`,
        lastModified: STATIC_LASTMOD,
        changeFrequency: "weekly",
        priority: 0.8,
      }));
    } catch (error) {
      console.error("Error fetching football teams for sitemap:", error);
    }

    const allPages = [
      ...staticPages,
      ...eventPages,
      ...artistPages,
      ...footballPages,
    ];

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
  .map(
    (page) => `
  <url>
    <loc>${page.url}</loc>
    <lastmod>${page.lastModified}</lastmod>
    <changefreq>${page.changeFrequency}</changefreq>
    <priority>${page.priority}</priority>
  </url>`,
  )
  .join("")}
</urlset>`;

    return new Response(sitemap, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    console.error("Error generating sitemap:", error);

    // Return basic sitemap with static pages only
    const baseUrl = "https://www.mega-events.co.il";
    const basicSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}</loc>
    <lastmod>2026-07-01T00:00:00.000Z</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;

    return new Response(basicSitemap, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=300, s-maxage=300", // Shorter cache on error
      },
    });
  }
}
