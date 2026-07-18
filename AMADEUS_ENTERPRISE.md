# Amadeus Enterprise API — onboarding & migration guide

This repo migrated off the `amadeus` npm SDK (Self-Service, being deprecated) to the
**Amadeus Enterprise REST API**, called directly over `fetch`. This guide covers what to
get from Amadeus, how to create a token, and how to fill the env.

> Same migration applies to the backoffice (`myt---backoffice`). It uses identical logic
> with the `NEXT_SECRET_` env prefix.

---

## 1. What you need from Amadeus for Developers

Everything comes from the Enterprise workspace:
**https://developers.amadeus.com/my-enterprise-ws/rest**

1. Log in (account: Dor AZOURI) → **My Enterprise Workspace** → **REST apps**.
2. Open the **"Mega events"** app (Status currently: **Test**).
3. From the app detail page copy:
   - **API Key**  → this is your `client_id`
   - **API Secret** → this is your `client_secret` (click reveal/show)
   - **Host / base URL** (if shown) → for `AMADEUS_API_HOST` / `AMADEUS_AUTH_HOST`
   - **Office ID** (if the app shows one — candidate `GOT 259889`)
4. Confirm the app's **enabled APIs** include:
   - **Flight Offers Search** (`GET /v2/shopping/flight-offers`)
   - **Flight Offers Price** (`POST /v1/shopping/flight-offers/pricing`)

No extra request is needed to start on **test** — the app is already provisioned.

---

## 2. How authentication works (OAuth2)

Amadeus uses the **client_credentials** grant. You POST your key+secret to the token
endpoint and get back a bearer `access_token` valid ~30 minutes. Every API call carries
`Authorization: Bearer <token>`.

The app (`app/api/flights/amadeusClient.ts`) does this automatically and caches the token
in memory, refreshing 60s before expiry. You only need to set the env values.

### Manual token test (curl)

```bash
# sandbox: https://test.travel.api.amadeus.com | production: https://travel.api.amadeus.com
curl -X POST "https://travel.api.amadeus.com/v1/security/oauth2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=YOUR_API_KEY&client_secret=YOUR_API_SECRET"
```

Response:

```json
{ "type": "amadeusOAuth2Token", "access_token": "ABCD...", "expires_in": 1799, ... }
```

### Manual API test (using that token)

```bash
curl "https://travel.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=TLV&destinationLocationCode=BCN&departureDate=2026-08-01&returnDate=2026-08-05&adults=1&max=5&currencyCode=USD" \
  -H "Authorization: Bearer ACCESS_TOKEN_FROM_ABOVE"
```

If both curls return data, your credentials + host are correct.

---

## 3. Fill the env

1. Copy `.env.amadeus.example` values into your `.env.local`.
2. Paste API Key → `NEW_AMADEUS_CLIENT_ID`, API Secret → `NEW_AMADEUS_CLIENT_SECRET`.
3. `AMADEUS_ENV=enterprise` for production (`test` for sandbox while developing).
4. No Office ID env — the office is bound to the OAuth credential (sending an
   office header trips error 2668 on this gateway).

| Variable | Meaning |
|----------|---------|
| `AMADEUS_ENV` | `test` (sandbox, test.travel.api.amadeus.com) or `enterprise` (production, travel.api.amadeus.com) |
| `AMADEUS_AUTH_HOST` | OAuth token host override (optional — defaults per `AMADEUS_ENV`) |
| `AMADEUS_API_HOST` | Flight APIs host override (optional — defaults per `AMADEUS_ENV`) |
| `NEW_AMADEUS_CLIENT_ID` | API Key |
| `NEW_AMADEUS_CLIENT_SECRET` | API Secret |

> Backoffice uses the same variables with a `NEXT_SECRET_` prefix
> (e.g. `NEXT_SECRET_AMADEUS_CLIENT_ID`).

---

## 4. Going to production

**DONE 2026-07-18** — the app was promoted to Production. Live config:

- Host (auth + api): `https://travel.api.amadeus.com`
- `AMADEUS_ENV=enterprise` (defaults to that host)
- Production keys from the workspace → `NEW_AMADEUS_CLIENT_ID` / `NEW_AMADEUS_CLIENT_SECRET`

Rollback at any point: flip `AMADEUS_ENV=test` (sandbox host + keys) — no code change required.
