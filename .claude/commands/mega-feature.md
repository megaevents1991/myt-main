Plan and implement a new feature for the Mega Events platform following project conventions.

Before writing any code, answer these questions based on the request:

1. **Where does it live?** (`app/`, `components/`, `lib/`, or `app/api/`)
2. **Does it touch the order flow?** If yes, which step(s) and how does `OrderContext` need to change?
3. **Does it need a new API route?** Follow the pattern: `app/api/<name>/route.ts`, use `NextRequest`/`NextResponse`, validate input, handle errors with proper HTTP status codes.
4. **Does it need new types?** Add them to `lib/app.types.ts` only.
5. **Does it affect pricing?** Use `lib/price.utils.tsx` and `exchangeRateService.ts`.
6. **Does it need analytics?** Add Mixpanel + GTM events at meaningful user actions.
7. **Is it user-facing?** Must be Hebrew, RTL, and use Mantine/shadcn/Tailwind (no new UI libraries).

Then implement the feature. After implementation, self-check against `/mega-review`.

Feature request: $ARGUMENTS
