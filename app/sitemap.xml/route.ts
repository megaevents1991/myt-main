import { getCachedEvents } from "@/lib/eventsData";
import { contentfulClient } from "@/lib/contentful";
import { ArtistFields, FootballFields } from "@/lib/app.types";

export async function GET() {
  try {
    const events = await getCachedEvents();
    const baseUrl = "https://www.mega-events.co.il";
    const staticPages = [
      {
        url: baseUrl,
        lastModified: new Date().toISOString(),
        changeFrequency: "daily",
        priority: 1.0,
      },
      {
        url: `${baseUrl}/about`,
        lastModified: new Date().toISOString(),
        changeFrequency: "monthly",
        priority: 0.8,
      },
      {
        url: `${baseUrl}/faq`,
        lastModified: new Date().toISOString(),
        changeFrequency: "monthly",
        priority: 0.8,
      },
      {
        url: `${baseUrl}/artists`,
        lastModified: new Date().toISOString(),
        changeFrequency: "weekly",
        priority: 0.8,
      },
      {
        url: `${baseUrl}/football`,
        lastModified: new Date().toISOString(),
        changeFrequency: "weekly",
        priority: 0.8,
      },
      {
        url: `${baseUrl}/terms`,
        lastModified: new Date().toISOString(),
        changeFrequency: "monthly",
        priority: 0.3,
      },
      {
        url: `${baseUrl}/cancellation`,
        lastModified: new Date().toISOString(),
        changeFrequency: "monthly",
        priority: 0.3,
      },
    ];
    const eventPages = events.events.map((event) => ({
      url: `${baseUrl}/order/${event.id}`,
      lastModified: new Date().toISOString(),
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
      const { items: artists } =
        await contentfulClient.getEntries<ArtistFields>({
          content_type: "artistTemplate",
        });

      artistPages = artists.map((artist) => ({
        url: `${baseUrl}/artists/${artist.sys.id}`,
        lastModified: new Date().toISOString(),
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
      const { items: footballTeams } =
        await contentfulClient.getEntries<FootballFields>({
          content_type: "footballTeamTemplate",
        });

      footballPages = footballTeams.map((team) => ({
        url: `${baseUrl}/football/${team.sys.id}`,
        lastModified: new Date().toISOString(),
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
    const baseUrl = "https://mega-events.co.il";
    const basicSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
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
