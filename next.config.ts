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
        protocol: "https",
        hostname: "fandqafngybfdyslofmr.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/card_images/**",
      },
      {
        protocol: "https",
        hostname: "fandqafngybfdyslofmr.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/map_images/**",
      },
      {
        protocol: "https",
        hostname: "fandqafngybfdyslofmr.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/art_blobs/**",
      },
      {
        protocol: "https",
        hostname: "fandqafngybfdyslofmr.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/templates/**",
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
};

module.exports = nextConfig;
