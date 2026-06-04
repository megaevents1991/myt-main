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
curl -X POST "https://test.api.amadeus.com/v1/security/oauth2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=YOUR_API_KEY&client_secret=YOUR_API_SECRET"
```

Response:

```json
{ "type": "amadeusOAuth2Token", "access_token": "ABCD...", "expires_in": 1799, ... }
```

### Manual API test (using that token)

```bash
curl "https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=TLV&destinationLocationCode=BCN&departureDate=2026-08-01&returnDate=2026-08-05&adults=1&max=5&currencyCode=USD" \
  -H "Authorization: Bearer ACCESS_TOKEN_FROM_ABOVE"
```

If both curls return data, your credentials + host are correct.

---

## 3. Fill the env

1. Copy `.env.amadeus.example` values into your `.env.local`.
2. Paste API Key → `AMADEUS_CLIENT_ID`, API Secret → `AMADEUS_CLIENT_SECRET`.
3. Keep `AMADEUS_ENV=test` (and the test hosts) while developing.
4. Set `AMADEUS_OFFICE_ID` only if the app requires it.

| Variable | Meaning |
|----------|---------|
| `AMADEUS_ENV` | `test` (sandbox) or `enterprise` (production) |
| `AMADEUS_AUTH_HOST` | OAuth token host |
| `AMADEUS_API_HOST` | Flight APIs host |
| `AMADEUS_CLIENT_ID` | API Key |
| `AMADEUS_CLIENT_SECRET` | API Secret |
| `AMADEUS_OFFICE_ID` | optional Office ID (Enterprise scoping) |

> Backoffice uses the same variables with a `NEXT_SECRET_` prefix
> (e.g. `NEXT_SECRET_AMADEUS_CLIENT_ID`).

---

## 4. Going to production

1. Validate everything on **test** in both apps (flight search, pricing/baggage, fallback,
   airline markups, El Al virtual offer, backoffice event price fill).
2. Submit Amadeus's **QA / certification (go-live) form**.
3. On approval, Amadeus promotes the **"Mega events"** app from **Test → Production** and
   provides the production host/quota.
4. Switch `AMADEUS_ENV=enterprise` and paste the production host + credentials, then redeploy.

Rollback at any point: flip `AMADEUS_ENV` (or env values) back to the working set — no code
change required.
