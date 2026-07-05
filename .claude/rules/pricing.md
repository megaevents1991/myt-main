# Pricing Rule (always-on) — myt-main

The customer-facing end of a price chain that spans both repos. Bugs here = wrong charges.

- **Internal prices are USD.** Convert to ILS only at display, via `lib/exchangeRateService.ts`. **NEVER hardcode an exchange rate.**
- **Final package** = `base_flight_price + base_hotel_price + min_ticket_price + NEXT_PUBLIC_MARKUP (175 ILS)`. Use `lib/price.utils.tsx` helpers — don't re-derive inline.
- **Sports ticket prices are stored in cents** → divide by 100 before use.
- Base prices (`base_flight_price`, `base_hotel_price`) and per-currency markups (USD +$40 / EUR +€40 / GBP +£35 / ILS +₪150) are set by the **backoffice**. This app must not re-apply those — it only adds the 175 markup.
- Touching price math? Run `/price-audit` and re-check the full chain in both repos. See [[cross-project]].
