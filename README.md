# BlackLabel Car Services — NestJS Backend (Phase 2)

## Setup

```bash
npm install
cp .env.example .env    # fill in Supabase, Google Maps, Stripe, FCM keys
npm run build           # verified: compiles cleanly
npm test                # pricing engine unit tests (16/16 passing)
npm run start:dev       # http://localhost:3000/api/v1
```

Requires the Supabase schema from Phase 1 to already be applied (migrations + seed).

## Environment variables

See `.env.example`. Notably:
- `SUPABASE_SERVICE_ROLE_KEY` — used for all backend DB access (bypasses RLS; the API layer is the trust boundary here).
- `SUPABASE_JWT_SECRET` — used to verify the Supabase-issued access tokens on incoming requests and WebSocket connections.
- `GOOGLE_MAPS_API_KEY` — server-side route/distance calculation (never trust a client-supplied distance for pricing).
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — payment intents + webhook verification.

## Architecture

- **Auth boundary**: Supabase Auth issues JWTs (register/login proxied through `/auth`), verified here via `JwtStrategy` + `JwtAuthGuard`. `RolesGuard` + `@Roles()` enforce customer/admin/chauffeur access.
- **Pricing**: `pricing.calculator.ts` holds pure, unit-tested functions mirroring the SQL functions from Phase 1 exactly (same tie-break on the 200km boundary, same clamping, same validation). `PricingService` fetches live rates from Supabase so admin edits apply without a redeploy.
- **Reservations**: distance/duration always computed server-side via `MapsService` (Google Directions) — the mobile app's numbers are for UI only, never for pricing.
- **Real-time tracking**: Socket.IO gateway at `/tracking`, JWT-authenticated on connect. Chauffeur pushes `location:update`; customer/admin join a `reservation:<id>` room to receive it.
- **Payments**: Stripe PaymentIntents + webhook (`POST /payments/webhook`), gated by signature verification, not JWT.
- **Invoices**: generated automatically when a reservation reaches `completed`; PDF built with `pdfkit`, uploaded to a private Supabase Storage bucket, downloaded via a short-lived signed URL.

## API summary (prefix: `/api/v1`)

| Method | Route | Access | Notes |
|---|---|---|---|
| POST | `/auth/register` | public | role: customer or chauffeur |
| POST | `/auth/login` | public | |
| POST | `/auth/refresh` | public | |
| GET  | `/auth/me` | authenticated | |
| GET  | `/vehicle-categories` | authenticated | pricing config per category |
| PUT  | `/vehicle-categories/:id` | admin | edit rates |
| GET  | `/vehicles` | authenticated | |
| POST | `/vehicles` | admin | |
| POST | `/pricing/quote` | authenticated | live price preview before booking |
| POST | `/reservations` | customer | creates + prices a reservation |
| GET  | `/reservations` | authenticated | scoped to caller's role |
| GET  | `/reservations/:id` | authenticated (involved or admin) | |
| PATCH | `/reservations/:id/assign-chauffeur` | admin | |
| PATCH | `/reservations/:id/status` | chauffeur (own trip) / admin / customer (cancel only) | |
| POST | `/payments/intent` | customer | Stripe PaymentIntent |
| POST | `/payments/webhook` | Stripe (signature-verified) | |
| GET  | `/payments` | customer | |
| GET  | `/invoices` | customer | |
| GET  | `/invoices/:id/download` | customer/admin | signed URL, 10 min expiry |
| GET  | `/notifications` | authenticated | |
| PATCH | `/notifications/:id/read` | authenticated | |
| WS   | `/tracking` | authenticated (handshake token) | `reservation:join`, `location:update` |
| GET  | `/admin/stats` | admin | dashboard counts + revenue |
| GET  | `/admin/customers` | admin | all customers + profile info |
| PATCH | `/admin/customers/:id/active` | admin | activate/deactivate an account |
| GET  | `/admin/chauffeurs` | admin | all chauffeurs + assigned vehicle |
| PATCH | `/admin/chauffeurs/:id` | admin | update license/status |

Note: `GET /invoices` and `GET /payments` now branch on role — admins get every row (with customer name joined in), everyone else gets only their own.

## What's stubbed / needs a decision before production

- **Push notifications**: `NotificationsService.pushToDevice()` is a stub — wire FCM/APNs once device-token storage is designed.
- **Payment provider**: Stripe is the reference implementation; `PaymentsService`'s public contract (`createIntent` / `handleWebhookEvent`) is the seam to swap providers.
- **Reservation lifecycle**: reservations are created as `confirmed` directly for a usable end-to-end flow; production should likely start at `pending` and flip to `confirmed` only after `payment_intent.succeeded` (the webhook handler already does this update — just change the initial insert status).

## Next phase

3. Flutter customer app (auth, booking flow, live tracking map, payments, invoices)
4. Admin dashboard / chauffeur app
