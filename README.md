# Mega Events — מגה איבנטס

> The only Israeli platform where you build your own custom travel package to music and sports events worldwide — official tickets, flexible flights, and quality hotels in one place.

**Live site:** [mega-events.co.il](https://mega-events.co.il)

---

## Overview

Mega Events is a Next.js 15 web application for [Mega Travel](https://mega-events.co.il), Israel's leading event travel agency with 30+ years of experience. Users can browse upcoming concerts and sports events, select official tickets, add flights and hotels, and complete a full booking — all from a single flow.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 15](https://nextjs.org/) (App Router, ISR) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS + Mantine 7 |
| Database / Auth | [Supabase](https://supabase.com/) |
| CMS | [Contentful](https://www.contentful.com/) |
| Flights API | [Amadeus](https://developers.amadeus.com/) |
| Hotels API | Emerging Travel (RateHawk) |
| Tickets | XS2Event, Tixstock |
| Payments | CreditGuard gateway |
| Maps | Mapbox GL / react-map-gl |
| Analytics | Mixpanel, Google Tag Manager, Facebook Pixel |
| Email | Nodemailer |
| Hosting | Vercel |

---

## Project Structure

```
app/
├── page.tsx                  # Homepage (ISR, 1hr revalidation)
├── layout.tsx                # Root layout — fonts, GTM, Mantine, header/footer
├── order/[eventId]/          # Multi-step booking flow
│   ├── TicketSelection.tsx
│   ├── FlightSelection.tsx
│   ├── HotelSelection.tsx
│   ├── OrderReview.tsx
│   └── OrderForm.tsx
├── artists/[slug]/           # Artist detail pages
├── football/[slug]/          # Football team pages
├── api/
│   ├── events/               # Event listing & detail
│   ├── flights/              # Amadeus flight search
│   ├── hotels/               # Hotel search & info
│   ├── payment/              # CreditGuard payment gateway
│   ├── confirm-order/        # Order confirmation
│   ├── find-order/           # Order lookup
│   ├── sendUserEmail.ts      # Transactional email
│   └── affiliate/            # Affiliate tracking
├── faq/ terms/ privacy/      # Static content pages
├── cancellation/ confirmation/
└── accessibility/ about/ partner/

components/
├── ui/                       # Shared UI components (shadcn + custom)
├── ClientSideHomepage.tsx    # Homepage event carousel & filters
└── PrintableOrderSummary.tsx # Printable booking confirmation

lib/
├── supabase.ts               # Supabase client
├── contentful.ts             # Contentful client
├── eventsData.ts             # Cached event fetching
├── app.types.ts              # Shared TypeScript types
├── prepareFlightsData.ts     # Amadeus flight normalizer
├── hotelFilter.ts / flightFilter.ts / flightSort.ts
└── price.utils.tsx           # Pricing & markup helpers

middleware.ts                 # Cache headers + Mondial 2026 redirect
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- Yarn (preferred) or npm

### 1. Clone and install

```bash
git clone <repo-url>
cd myt---main
yarn install
```

### 2. Set up environment variables

Copy the example file and fill in your credentials:

```bash
cp .env.example .env.local
```

Required variables — see the table below.

### 3. Run the dev server

```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Description |
|---|---|
| `AMADEUS_CLIENT_ID` | Amadeus API client ID (flights) |
| `AMADEUS_CLIENT_SECRET` | Amadeus API client secret |
| `EMERGING_TRAVEL_API_KEY` | RateHawk/Emerging Travel key (hotels) |
| `EMERGING_TRAVEL_API_SECRET` | RateHawk/Emerging Travel secret |
| `NEXT_SECRET_SUPABASE_URL` | Supabase project URL |
| `NEXT_SECRET_SUPABASE_SERVICE_KEY` | Supabase service role key (server only) |
| `CONTENTFUL_SPACE_ID` | Contentful space ID |
| `CONTENTFUL_ACCESS_TOKEN` | Contentful delivery token |
| `NEXT_SECRET_CG_GATEWAY_URL` | CreditGuard gateway URL |
| `NEXT_SECRET_CG_TERMINAL` | CreditGuard terminal ID |
| `NEXT_SECRET_CG_USER_NAME` | CreditGuard username |
| `NEXT_SECRET_CG_PASSWORD` | CreditGuard password |
| `NEXT_SECRET_CG_MID` | CreditGuard merchant ID |
| `NEXT_SECRET_XS2EVENT_API_KEY` | XS2Event ticket API key |
| `NEXT_SECRET_XS2EVENT_API_URL` | XS2Event API base URL |
| `EMAIL_SERVER_USER` | SMTP username (Nodemailer) |
| `EMAIL_SERVER_PASSWORD` | SMTP password |
| `SALES_REP_EMAIL` | Sales rep email for order notifications |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox public access token |
| `NEXT_PUBLIC_MIXPANEL_TOKEN` | Mixpanel project token |
| `NEXT_PUBLIC_GTM` | Google Tag Manager container ID |
| `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` | Facebook Pixel ID |
| `NEXT_PUBLIC_MARKUP` | Default ticket markup (e.g. `175`) |
| `NEXT_PUBLIC_BOUNDRIES` | Search boundary radius |
| `NEXT_PUBLIC_API_URL` | Base API URL (e.g. `http://localhost:3000`) |
| `NEXT_SECRET_REVALIDATION_SECRET` | Secret for on-demand ISR revalidation |

> **Never commit `.env.local`.** It is gitignored. Only commit `.env.example` with placeholder values.

---

## Key Scripts

```bash
yarn dev       # Start development server
yarn build     # Production build
yarn start     # Start production server
yarn lint      # Run ESLint
```

---

## Caching Strategy

- Homepage and event pages use **ISR** with a 1-hour `revalidate` interval.
- On-demand revalidation is available via `/api/revalidate` using `NEXT_SECRET_REVALIDATION_SECRET`.
- Middleware sets `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400` on HTML pages.
- A permanent `308` redirect in middleware handles the Mondial 2026 legacy URL.

---

## Content Management

Events, artists, and football teams are managed in **Contentful**:

- `artistTemplate` — artist pages with bio, banner, and preview text
- `footballTeamTemplate` — football team pages
- Carousel ordering is controlled by dedicated Contentful carousel entries (not alphabetical)

---

## Deployment

The app is deployed on **Vercel**. Server Actions are allowed from:
- `www.mega-events.co.il`
- `pps.creditguard.co.il` (payment callback)

Push to `main` triggers an automatic production deployment.

---

## Contributing

1. Create a feature branch off `main`
2. Make your changes
3. Run `yarn lint` and fix any issues
4. Open a pull request — include what changed and how to test it

---

© 2025 מגה תיירות. All rights reserved.
