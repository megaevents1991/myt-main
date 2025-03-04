const nextConfig: import("next").NextConfig = {
  reactStrictMode: false,
  experimental: {
    optimizePackageImports: ["@mantine/core", "@mantine/hooks"],
  },
  images: {
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
    ],
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'header',
            key: 'host',
            value: 'www.mega-events.co.il',
          }
        ],
        permanent: true,
        destination: 'https://mega-events.co.il/:path*',
      },
      {
      source: '/',
      has: [
        {
        type: 'query',
        key: 'aff',
        value: '(?<affValue>.*)',
        },
      ],
      missing: [
        {
        type: 'query',
        key: 'utm_source',
        },
      ],
      permanent: false,
      destination: '/?aff=:affValue&utm_source=:affValue&r=1',
      },
      {
      source: '/artists',
      has: [
        {
        type: 'query',
        key: 'aff',
        value: '(?<affValue>.*)',
        },
      ],
      missing: [
        {
        type: 'query',
        key: 'utm_source',
        },
      ],
      permanent: false,
      destination: '/artists?aff=:affValue&utm_source=:affValue&r=1',
      },
      {
      source: '/artists/:path*',
      has: [
        {
        type: 'query',
        key: 'aff',
        value: '(?<affValue>.*)',
        },
      ],
      missing: [
        {
        type: 'query',
        key: 'utm_source',
        },
      ],
      permanent: false,
      destination: '/artists/:path*?aff=:affValue&utm_source=:affValue&r=1',
      },
      {
        source: '/football',
        has: [
          {
          type: 'query',
          key: 'aff',
          value: '(?<affValue>.*)',
          },
        ],
        missing: [
          {
          type: 'query',
          key: 'utm_source',
          },
        ],
        permanent: false,
        destination: '/football?aff=:affValue&utm_source=:affValue&r=1',
        },
      {
      source: '/football/:path*',
      has: [
        {
        type: 'query',
        key: 'aff',
        value: '(?<affValue>.*)',
        },
      ],
      missing: [
        {
        type: 'query',
        key: 'utm_source',
        },
      ],
      permanent: false,
      destination: '/football/:path*?aff=:affValue&utm_source=:affValue&r=1',
      },
    ];
  }
};

module.exports = nextConfig;
