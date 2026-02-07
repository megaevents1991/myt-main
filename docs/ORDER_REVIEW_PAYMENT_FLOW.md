# Order Review & Payment Flow - Technical Documentation

> **Last Updated:** January 2026  
> **Maintainer:** Development Team  
> **Version:** 1.0

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Client-Side Components](#client-side-components)
4. [Server-Side API Routes](#server-side-api-routes)
5. [Payment Gateway Integration](#payment-gateway-integration)
6. [Data Flow & State Management](#data-flow--state-management)
7. [Order Statuses](#order-statuses)
8. [Email Notifications](#email-notifications)
9. [Affiliate & Referral System](#affiliate--referral-system)
10. [Analytics Tracking](#analytics-tracking)
11. [Error Handling](#error-handling)
12. [Environment Variables](#environment-variables)
13. [Database Schema (Supabase)](#database-schema-supabase)

---

## Overview

The Order Review is the final step in the booking funnel where users:

- Review their selected event tickets, flights, and hotel
- Enter passenger details
- Choose a payment method
- Complete the order

### Supported Payment Methods

| Method                    | Description                                      | Status After Submission           |
| ------------------------- | ------------------------------------------------ | --------------------------------- |
| **Credit Card (Pay Now)** | Immediate online payment via CreditGuard gateway | `Paid` (after successful payment) |
| **Phone Order**           | User requests a callback from sales rep          | `Pending`                         |
| **24-Hour Hold**          | Reservation held for 24 hours without payment    | `24Save`                          |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT SIDE                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐  │
│  │  OrderReview    │───▶│  OrderContext   │───▶│  State: flight, hotel,  │  │
│  │  Component      │    │  (app.context)  │    │  event, passengers, etc │  │
│  └────────┬────────┘    └─────────────────┘    └─────────────────────────┘  │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  handleSubmit(payNow, onlySave)                                     │    │
│  │  • Validates passenger forms                                        │    │
│  │  • Submits to /api/confirm-order                                    │    │
│  │  • If payNow: Requests payment URL from /api/payment                │    │
│  │  • Redirects to payment gateway or confirmation page                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SERVER SIDE (API Routes)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────┐                                                    │
│  │ /api/confirm-order  │  POST - Create reservation in Supabase            │
│  │                     │  • Validates order data (Yup schema)               │
│  │                     │  • Inserts into `reservations` table               │
│  │                     │  • Creates partner referral code                   │
│  │                     │  • Sends email to sales rep                        │
│  │                     │  • Sends confirmation email (non-payNow)           │
│  └──────────┬──────────┘                                                    │
│             │                                                                │
│             ▼                                                                │
│  ┌─────────────────────┐                                                    │
│  │ /api/payment        │  POST - Initialize payment session                 │
│  │                     │  • Builds XML payload (CreditGuard format)         │
│  │                     │  • Returns hosted payment page URL                 │
│  └──────────┬──────────┘                                                    │
│             │                                                                │
│             ▼                                                                │
│  ┌─────────────────────────────────────────────┐                            │
│  │ CreditGuard Payment Gateway                  │                            │
│  │ (External - mpiHostedPageUrl)                │                            │
│  └──────────┬──────────────────────────────────┘                            │
│             │                                                                │
│             ▼                                                                │
│  ┌─────────────────────────────────────────────┐                            │
│  │ /api/confirmation/[orderId]/[promoCode]/    │                            │
│  │              [result]                        │                            │
│  │ POST - Payment callback handler              │                            │
│  │ • Receives form data from gateway            │                            │
│  │ • Redirects to client confirmation page      │                            │
│  └──────────┬──────────────────────────────────┘                            │
│             │                                                                │
│             ▼                                                                │
│  ┌─────────────────────────────────────────────┐                            │
│  │ /api/payment/[id]/[txId]/[promoCode]        │                            │
│  │ GET - Validate transaction                   │                            │
│  │ • Queries CreditGuard for tx status          │                            │
│  │ • Updates reservation status                 │                            │
│  │ • Sends confirmation email                   │                            │
│  └─────────────────────────────────────────────┘                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Client-Side Components

### OrderReview Component

**Location:** `app/order/OrderReview.tsx`

The main component for the final checkout step.

#### Key State Variables

```typescript
// From OrderContext (global booking state)
const {
  flight: selectedFlight,    // Selected flight details
  hotel: selectedHotel,      // Selected hotel (optional)
  eventTicket,               // Selected ticket category
  event,                     // Event information
  numberOfEventTickets,      // Ticket quantity
  skipHotel,                 // Whether user skipped hotel selection
  passengers: passengersContext,
} = useContext(OrderContext);

// Local state
const [passengers, setPassengers] = useState<Passenger[]>([...]);
const [validationErrors, setValidationErrors] = useState<ValidationErrors[]>([...]);
const [termsAccepted, setTermsAccepted] = useState(false);
const [isSubmitting, setIsSubmitting] = useState(false);
const [finalPurchasePriceILS, setFinalPurchasePriceILS] = useState(0);
```

#### Passenger Validation

Validation rules defined in `app/order/order-review.utils.ts`:

| Field       | Rules                                              |
| ----------- | -------------------------------------------------- |
| `firstName` | Required, min 2 chars, English letters only        |
| `lastName`  | Required, min 2 chars, English letters only        |
| `email`     | Required, valid email format (main passenger only) |
| `phone`     | Required, valid phone format (main passenger only) |

**Validation Behavior by Payment Type:**

- **Credit Card / Phone Order**: All passengers' first and last names required
- **24-Hour Hold**: Only main passenger details required

#### Price Calculation

Pricing logic lives in `app/order/hooks.tsx` via `useOrderVars()`:

```typescript
const finalPurchasePriceCalc = (affDiscount: number) => {
  // Base calculation:
  // (eventTicket.price + markup) × numberOfTickets
  // + (flightPriceAddition + base_flight_price) × numTravelers
  // + (hotelPriceAddition + base_hotel_price) × totalGuests
  // Affiliate discount:
  // - 1-10: Percentage discount
  // - 11+: Absolute amount per ticket
};
```

### Supporting Hooks

#### `useFetchAffiliate()`

Retrieves affiliate information from URL params or localStorage.

```typescript
const { affId, affDiscount, agentCommission, setAffDiscount } =
  useFetchAffiliate();
```

#### `useOrderVars()`

Computes derived values for pricing:

- `numberOfPersons` - Max of travelers/tickets
- `finalPurchasePriceCalc()` - USD total
- `finalPurchasePriceILSCalc()` - ILS total (async, fetches exchange rate)
- `hotelPriceAddition` / `flightPriceAddition` - Price adjustments
- `getAffiliateDiscountTotalUsd()` - Total discount applied

---

## Server-Side API Routes

### 1. Create Order - `POST /api/confirm-order`

**Location:** `app/api/confirm-order/route.ts`

Creates a new reservation in the database.

#### Request Payload

```typescript
{
  payNow: boolean; // true = credit card payment
  onlySave: boolean; // true = 24-hour hold
  gtmIdnts: string; // GTM tracking identifiers

  // Order details (validated via Yup schema)
  main_contact_first_name: string;
  main_contact_last_name: string;
  main_contact_phone_number: string;
  main_contact_email: string;
  more_pax_info: {
    first_name: string;
    last_name: string;
  }
  [];
  event_order_info: EventOrderInfo;
  flight_order_info: FlightInfo;
  hotel_order_info: HotelInfo | {};
  user_shown_price: number; // USD
  final_purchase_price_ils: number; // ILS
  exchange_rate_usd_ils_100: number;
  event_id: number;
  aff_partner_tracking_code: string;
  is_agent_booking: boolean;
}
```

#### Response

```typescript
{
  message: string;
  bookingReference: string; // Format: "ME{day}{id}"
  newPromoterCode: string; // Auto-generated referral code
  id: number; // Reservation ID
}
```

#### Process Flow

1. **Validate** order data using Yup schema (`utils.ts`)
2. **Insert** reservation into `reservations` table (status: `Pending` or `24Save`)
3. **Create referral code** (for non-agent bookings):
   - Code format: `{firstName}_{reservationId}`
   - Insert into `partners` table with $40 commission, $20 user discount
4. **Email sales rep** with order details
5. **Generate booking reference** format: `ME{dayOfMonth}{reservationId}`
6. **Track analytics** (server-side GTM event)
7. **Send user email** (for phone orders / 24h hold only)

### 2. Get Order - `GET /api/confirm-order/[id]`

**Location:** `app/api/confirm-order/[id]/route.ts`

Fetches reservation details by ID.

### 3. Initialize Payment - `POST /api/payment`

**Location:** `app/api/payment/route.ts`

Initiates a payment session with CreditGuard.

#### Request

```typescript
{
  amount: number; // Amount in ILS
  email: string; // Customer email
  orderId: string; // Reservation ID
  promoCode: string; // Referral tracking code
}
```

#### Response

```typescript
{
  url: string; // CreditGuard hosted payment page URL
}
```

#### XML Payload Structure

Built by `buildDoDealXML()`:

```xml
<ashrait>
  <request>
    <command>doDeal</command>
    <doDeal>
      <terminalNumber>...</terminalNumber>
      <cardNo>CGMPI</cardNo>
      <total>{amount × 100}</total>
      <currency>ILS</currency>
      <successUrl>/api/confirmation/{orderId}/{promoCode}/success</successUrl>
      <errorUrl>/api/confirmation/{orderId}/{promoCode}/error</errorUrl>
      <cancelUrl>/api/confirmation/{orderId}/{promoCode}/cancel</cancelUrl>
      <numberOfPayments>5</numberOfPayments>
      <mpiValidation>AutoComm</mpiValidation>
      <!-- ... -->
    </doDeal>
  </request>
</ashrait>
```

### 4. Payment Callback - `POST /api/confirmation/[orderId]/[promoCode]/[result]`

**Location:** `app/api/confirmation/[orderId]/[promoCode]/[result]/route.ts`

Handles callback from CreditGuard after payment attempt.

#### Behavior

1. Extracts form data from payment gateway POST
2. Logs payment callback details
3. Redirects to client-side confirmation page with query params:
   ```
   /confirmation/{orderId}/{promoCode}/{result}?txId=...&...
   ```

### 5. Validate Transaction - `GET /api/payment/[id]/[txId]/[promoCode]`

**Location:** `app/api/payment/[id]/[txId]/[promoCode]/route.ts`

Validates transaction status with CreditGuard.

#### Process

1. Build inquiry XML using `buildTxQueryXML()`
2. Query CreditGuard gateway
3. Parse response to determine success/failure
4. Update reservation:
   - `status`: `Paid` or `Pending`
   - `payment_info`: Full gateway response
5. Send confirmation email (if not already sent)

#### Response

```typescript
{
  isSuccess: boolean;
}
```

---

## Payment Gateway Integration

### CreditGuard (CG)

The application integrates with CreditGuard's MPI (Merchant Plug-In) hosted payment page.

#### Configuration (Environment Variables)

| Variable                     | Description          |
| ---------------------------- | -------------------- |
| `NEXT_SECRET_CG_GATEWAY_URL` | Gateway endpoint URL |
| `NEXT_SECRET_CG_TERMINAL`    | Terminal number      |
| `NEXT_SECRET_CG_USER_NAME`   | API username         |
| `NEXT_SECRET_CG_PASSWORD`    | API password         |
| `NEXT_SECRET_CG_MID`         | Merchant ID          |

#### Payment Flow

```
1. User clicks "Pay Now"
          │
          ▼
2. Client calls POST /api/payment
          │
          ▼
3. Server builds XML and sends to CreditGuard
          │
          ▼
4. CreditGuard returns hosted page URL
          │
          ▼
5. Client redirects to mpiHostedPageUrl
          │
          ▼
6. User enters card details on CreditGuard page
          │
          ▼
7. CreditGuard POSTs to callback URL:
   /api/confirmation/{orderId}/{promoCode}/{success|error|cancel}
          │
          ▼
8. API redirects to client confirmation page
          │
          ▼
9. Client calls GET /api/payment/{id}/{txId}/{promoCode}
          │
          ▼
10. Server validates transaction and updates DB
```

#### Payment Settings

- **Currency:** ILS (Israeli Shekel)
- **Transaction Type:** Debit
- **Credit Type:** Payments (installments)
- **Number of Payments:** 5 (fixed)
- **MPI Validation:** AutoComm

---

## Data Flow & State Management

### OrderContext

**Location:** `app/app.context.ts`

Global context providing booking state across the order funnel:

```typescript
interface OrderContextType {
  event: Event | null;
  eventTicket: EventTicket;
  numberOfEventTickets: number;
  flight: Flight | null;
  hotel: OrderHotel | null;
  skipHotel: boolean;
  passengers: Passenger[] | undefined;
  paymentMethod: "credit_card" | "phone_order" | null;
  step: number;
  // ... setters
}
```

### Form State Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Passenger  │────▶│   Validate   │────▶│   Submit     │
│   Inputs     │     │   On Blur    │     │   On Click   │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       ▼                    ▼                    ▼
  [passengers]       [validationErrors]    [isSubmitting]
  [touched]                                      │
                                                 ▼
                                         submitOrder()
                                                 │
                                    ┌────────────┴────────────┐
                                    │                         │
                              payNow=true              payNow=false
                                    │                         │
                                    ▼                         ▼
                           getPaymentUrl()           router.push(
                                    │               /confirmation/...)
                                    ▼
                         window.location.replace(url)
```

---

## Order Statuses

| Status    | Description               | Trigger               |
| --------- | ------------------------- | --------------------- |
| `Pending` | Awaiting payment/callback | Phone order submitted |
| `24Save`  | 24-hour hold              | Hold option selected  |
| `Paid`    | Payment successful        | Transaction verified  |

---

## Email Notifications

### Email Templates

**Location:** `app/api/sendUserEmail.ts`, `app/api/confirm-order/utils.ts`

| Template             | Trigger                     | Content                           |
| -------------------- | --------------------------- | --------------------------------- |
| `successfulPurchase` | Payment verified successful | Confirmation + next steps         |
| `failedPurchase`     | Payment failed              | Issue notification + support info |
| `phoneOrder`         | Phone order submitted       | Pending callback notice           |
| `savedOrder`         | 24h hold created            | Hold confirmation + recovery link |

### Email Provider

- **SMTP Host:** `smtp.zeptomail.com`
- **Port:** 587
- **From:** `MegaEvents Reservations <reservations@mega-events.co.il>`

### Sales Rep Notification

Every order triggers an email to `SALES_REP_EMAIL` containing:

- Customer contact details
- Payment method
- Event details (name, date, tickets)
- Flight information
- Hotel details
- Pricing breakdown

---

## Affiliate & Referral System

### Automatic Referral Code Generation

For non-agent bookings, a referral code is automatically created:

```typescript
const partnerTrackingCode = `${firstName.toLowerCase()}_${orderId}`;
```

This is inserted into the `partners` table with:

- **Commission:** $40 per referred booking
- **User Discount:** $20 per ticket for referred users

### Discount Application

Affiliate discounts are applied based on the `aff_partner_tracking_code`:

- **Values 1-10:** Treated as percentage discount
- **Values 11+:** Treated as absolute USD amount per ticket

### Referral Link

Included in confirmation emails:

```
https://mega-events.co.il/?utm_source={partnerTrackingCode}
```

---

## Analytics Tracking

### Client-Side (Mixpanel)

```typescript
trackEvent("eventCheckout", {
  userFinalPrice,
  userFinalPriceILS,
  paymentMethod,
  affiliateId,
  eventId,
  // ...
});

trackEvent("eventPayment", {
  orderId,
  paymentStatus,
  // ...
});
```

### Server-Side (GTM)

```typescript
trackServerSideEvent({
  eventData: { id, name, value, currency, category, brand, quantity },
  eventType: "begin_checkout" | "generate_lead" | "purchase",
  gtmIdnts,
  userAgent,
  ip,
});
```

---

## Error Handling

### Client-Side

- Form validation errors displayed inline
- Terms checkbox validation
- Scroll to first error on submission
- Loading states with spinner
- Console logging for debugging

### Server-Side

- Yup validation with descriptive error messages
- Try-catch blocks with error logging
- Graceful fallbacks for analytics failures
- HTTP status codes:
  - `200` - Success
  - `500` - Server error

---

## Environment Variables

| Variable                        | Required | Description                  |
| ------------------------------- | -------- | ---------------------------- |
| `NEXT_SECRET_CG_GATEWAY_URL`    | Yes      | CreditGuard gateway URL      |
| `NEXT_SECRET_CG_TERMINAL`       | Yes      | CreditGuard terminal number  |
| `NEXT_SECRET_CG_USER_NAME`      | Yes      | CreditGuard username         |
| `NEXT_SECRET_CG_PASSWORD`       | Yes      | CreditGuard password         |
| `NEXT_SECRET_CG_MID`            | Yes      | CreditGuard merchant ID      |
| `EMAIL_SERVER_USER`             | Yes      | SMTP username (ZeptoMail)    |
| `EMAIL_SERVER_PASSWORD`         | Yes      | SMTP password                |
| `SALES_REP_EMAIL`               | Yes      | Sales notification recipient |
| `VERCEL_ENV`                    | Auto     | Deployment environment       |
| `VERCEL_PROJECT_PRODUCTION_URL` | Auto     | Production URL               |
| `VERCEL_BRANCH_URL`             | Auto     | Branch preview URL           |
| `NEXT_PUBLIC_API_URL`           | Dev      | Local development URL        |
| `NEXT_PUBLIC_MARKUP`            | No       | Price markup (default: 150)  |

---

## Database Schema (Supabase)

### `reservations` Table

| Column                      | Type    | Description                      |
| --------------------------- | ------- | -------------------------------- |
| `id`                        | int     | Primary key (auto-increment)     |
| `main_contact_first_name`   | text    | Main passenger first name        |
| `main_contact_last_name`    | text    | Main passenger last name         |
| `main_contact_phone_number` | text    | Phone number                     |
| `main_contact_email`        | text    | Email address                    |
| `more_pax_info`             | jsonb   | Additional passengers array      |
| `event_order_info`          | jsonb   | Event booking details            |
| `flight_order_info`         | jsonb   | Flight booking details           |
| `hotel_order_info`          | jsonb   | Hotel booking details (nullable) |
| `user_shown_price`          | numeric | Price shown to user (USD)        |
| `final_purchase_price_ils`  | numeric | Final price in ILS               |
| `exchange_rate_usd_ils_100` | numeric | Exchange rate × 100              |
| `event_id`                  | int     | Foreign key to events            |
| `status`                    | text    | Order status                     |
| `payment_info`              | jsonb   | Payment gateway response         |
| `booking_reference`         | text    | Public booking reference         |
| `aff_partner_tracking_code` | text    | Affiliate tracking code          |
| `confirmation_email_sent`   | boolean | Email sent flag                  |
| `gtmIdnts`                  | text    | GTM tracking identifiers         |

### `partners` Table

| Column                  | Type    | Description                  |
| ----------------------- | ------- | ---------------------------- |
| `partner_tracking_code` | text    | Unique referral code         |
| `name_hebrew`           | text    | Partner name                 |
| `email`                 | text    | Partner email                |
| `password`              | text    | Partner password             |
| `commission`            | numeric | Commission per booking (USD) |
| `user_discount`         | numeric | Discount for referred users  |
| `created_at`            | date    | Creation date                |

---

## Feature Flags & Restrictions

### Event-Specific Restrictions

Certain events can disable specific features:

```typescript
// Block 24h hold for specific events
const isHoldAllowed = useMemo(() => {
  const blockedEvents = ["ariana grande"];
  // Check if event name matches blocked list
}, [event?.name_english]);

// Block special offer (inactivity discount) for specific events
const isSpecialOfferAllowed = useMemo(() => {
  // Similar logic for special offer restrictions
}, [event?.name_english]);
```

### Special Offer (Inactivity Detection)

If the user is inactive for a period, a modal with an additional discount may appear (configurable per event).

---

## File Index

| File                                                           | Purpose                            |
| -------------------------------------------------------------- | ---------------------------------- |
| `app/order/OrderReview.tsx`                                    | Main checkout component            |
| `app/order/hooks.tsx`                                          | Price calculation hooks            |
| `app/order/order-review.utils.ts`                              | Validation utilities               |
| `app/api/confirm-order/route.ts`                               | Create order endpoint              |
| `app/api/confirm-order/[id]/route.ts`                          | Get/update order endpoint          |
| `app/api/confirm-order/utils.ts`                               | Validation schema & email template |
| `app/api/payment/route.ts`                                     | Initialize payment                 |
| `app/api/payment/buildDoDealXML.ts`                            | Payment XML builder                |
| `app/api/payment/[id]/[txId]/[promoCode]/route.ts`             | Transaction validation             |
| `app/api/payment/[id]/[txId]/[promoCode]/buildTxQueryXML.ts`   | Query XML builder                  |
| `app/api/confirmation/[orderId]/[promoCode]/[result]/route.ts` | Payment callback                   |
| `app/api/sendUserEmail.ts`                                     | Email sending utility              |
| `app/confirmation/[...params]/page.tsx`                        | Confirmation page                  |
| `lib/app.types.ts`                                             | Type definitions                   |

---

## Future Considerations

1. **Payment Retry Logic** - Consider implementing automatic retry for failed payments
2. **Webhook Support** - Add webhook endpoints for payment notifications
3. **Multi-Currency** - Support additional currencies beyond ILS
4. **Payment Methods** - Add support for additional payment providers
5. **Order Recovery** - Enhanced 24h hold recovery flow with deep links
6. **Error Monitoring** - Integrate with error tracking service (Sentry, etc.)

---

_This documentation should be updated when significant changes are made to the order review or payment flow._
