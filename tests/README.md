# E2E Tests (Playwright)

End-to-end tests for **both** MYT apps, run from this repo:

| App        | What                          | Port | Source                   |
| ---------- | ----------------------------- | ---- | ------------------------ |
| main       | Customer-facing booking app   | 3000 | this repo                |
| backoffice | Admin dashboard               | 3001 | `../../MYT-backoffice-app` |

Both dev servers start automatically — you don't need to run `yarn dev` yourself.
If a server is already running on its port, it's reused.

## Setup (one time)

1. Browser is already installed. To reinstall: `npx playwright install chromium`
2. Copy `.env.example` → `.env` and fill in the backoffice admin login:
   ```
   BACKOFFICE_EMAIL=...
   BACKOFFICE_PASSWORD=...
   ```
   Use the same values as `../../MYT-backoffice-app/.env.local`
   (`NEXT_SECRET_ADMIN_EMAIL` / `NEXT_SECRET_ADMIN_PASSWORD`).
   Without them, backoffice authenticated tests skip themselves.

## Run

```bash
yarn test:e2e              # everything
yarn test:e2e:main         # main app only
yarn test:e2e:backoffice   # backoffice only
yarn test:e2e:ui           # interactive UI mode
yarn test:e2e:report       # open last HTML report
```

## Layout

```
tests/
  playwright.config.ts   2 projects (main, backoffice), 2 auto-started dev servers
  global-setup.ts        logs into backoffice once → saves session to .auth/
  .env                   secrets (gitignored)
  main/
    smoke.spec.ts        homepage loads, event opens order page
    order-flow.spec.ts   ticket selection; full funnel is a fixme skeleton
  backoffice/
    smoke.spec.ts        login + dashboard/events/offline pages
```

## Notes

- Backoffice tests reuse a logged-in session from `global-setup.ts` — no per-test login.
- `order-flow.spec.ts` covers step 1 (ticket). The full flight→hotel→review
  walkthrough is a `test.fixme` skeleton — it needs selectors from
  `app/order/{FlightSelection,HotelSelection,OrderReview}.tsx` and hits live
  provider APIs.
- Output (`playwright-report/`, `test-results/`, `.auth/`) is gitignored.
