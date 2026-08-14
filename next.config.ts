const nextConfig: import("next").NextConfig = {
  reactStrictMode: false,
  experimental: {
    optimizePackageImports: ["@mantine/core", "@mantine/hooks"],
    serverActions: {
      allowedOrigins: ["www.mega-events.co.il", "pps.creditguard.co.il"],
    },
  },
  images: {
    minimumCacheTTL: 86400,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
      {
        // Every PUBLIC bucket of our own Supabase project. Was an explicit
        // per-bucket allowlist, which silently broke images whenever the
        // backoffice started writing a new bucket - the generated campaign
        // creatives (`creatives/output/*`, set as `events.card_image_url`)
        // 400'd in the image optimizer and rendered as a black/broken card.
        // Private buckets are unreachable without a signed URL anyway.
        protocol: "https",
        hostname: "fandqafngybfdyslofmr.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "www.avcodes.co.uk",
        port: "",
        pathname: "/images/logos/**",
      },
      {
        protocol: "https",
        hostname: "cdn.worldota.net",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.ctfassets.net",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.xs2event.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "doctorticket.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.doctorticket.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
        port: "",
        pathname: "/wikipedia/**",
      },
      {
        protocol: "https",
        hostname: "tixstock.s3.eu-west-2.amazonaws.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
  // One category URL. /category/<slug> used to be its own page listing member
  // pages and no events; /c/ is the category page. Redirecting in config rather
  // than from a route handler keeps it independent of any data lookup - and /c/
  // resolves a category by its LAST path segment, so the flat destination lands
  // on the canonical nested path by itself.
  async redirects() {
    return [
      { source: "/category/:slug", destination: "/c/:slug", permanent: true },
      // LEGACY-ROUTE: /c/ is canonical (docs/LEGACY-ROUTES-TODO.md). Config
      // redirects give a real 308 at the CDN (a page-level permanentRedirect
      // on a static route bakes to a 200 meta-refresh instead). Exact paths
      // only - /football/:id and /artists/:id redirect per-person in-page.
      { source: "/football", destination: "/c/football/teams", permanent: true },
      { source: "/artists", destination: "/c/music/artists", permanent: true },
    ];
  },
};

module.exports = nextConfig;
