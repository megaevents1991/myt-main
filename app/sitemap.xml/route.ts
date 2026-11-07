import { getCachedEvents } from "@/lib/eventsData";
import { getAllBlogPosts } from "@/lib/blog";
import { getAllCategories } from "@/lib/taxonomy";
import { slugPathOf } from "@/lib/taxonomy-tree";

// Category nodes whose page only redirects (app/c/[...slug]/page.tsx: the old
// leagues/genres pickers now live on the /c/football and /c/music hubs).
const REDIRECT_ONLY_CATEGORY_SLUGS = new Set(["leagues", "genres"]);

export async function GET() {
  try {
    const events = await getCachedEvents();
    const baseUrl = "https://www.mega-events.co.il";
    // Stable date for static pages - bump manually on meaningful content changes.
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
        url: `${baseUrl}/blog`,
        lastModified: STATIC_LASTMOD,
        changeFrequency: "weekly",
        priority: 0.6,
      },
      {
        url: `${baseUrl}/privacy`,
        lastModified: STATIC_LASTMOD,
        changeFrequency: "monthly",
        priority: 0.3,
      },
      {
        url: `${baseUrl}/accessibility`,
        lastModified: STATIC_LASTMOD,
        changeFrequency: "monthly",
        priority: 0.3,
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
      {
        url: `${baseUrl}/cancel-order`,
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

    // No /artists/<slug> or /football/<slug>: those legacy routes only redirect
    // to their /c/ twin (docs/LEGACY-ROUTES-TODO.md), which is listed below.

    // Active blog posts (same list and URL as app/blog/page.tsx).
    let blogPages: Array<{
      url: string;
      lastModified: string;
      changeFrequency: string;
      priority: number;
    }> = [];
    try {
      const posts = await getAllBlogPosts();
      blogPages = posts.map((post) => ({
        url: `${baseUrl}/blog/${post.sys.id}`,
        lastModified: STATIC_LASTMOD,
        changeFrequency: "monthly",
        priority: 0.6,
      }));
    } catch (error) {
      console.error("Error fetching blog posts for sitemap:", error);
    }

    // Taxonomy category pages (/c/football/premier-league...) - canonical
    // nested paths only, active categories only.
    let categoryPages: Array<{
      url: string;
      lastModified: string;
      changeFrequency: string;
      priority: number;
    }> = [];
    try {
      const cats = await getAllCategories();
      categoryPages = cats
        .filter((cat) => !REDIRECT_ONLY_CATEGORY_SLUGS.has(cat.slug))
        .map((cat) => ({
          url: `${baseUrl}/c/${slugPathOf(cat, cats).join("/")}`,
          lastModified: cat.updated_at || STATIC_LASTMOD,
          changeFrequency: "weekly",
          priority: 0.8,
        }));
    } catch (error) {
      console.error("Error fetching taxonomy categories for sitemap:", error);
    }

    const allPages = [
      ...staticPages,
      ...eventPages,
      ...blogPages,
      ...categoryPages,
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
