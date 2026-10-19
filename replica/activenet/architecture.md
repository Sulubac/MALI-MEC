# Architecture: ActiveNet clone (clean-room)

Inputs: `recon.md`, `features.csv` (inferred from public sources). Schema: `schema.sql` (loaded and checked on Postgres 16:
39 statements pass; a second overlapping reservation and a second seat on a capacity-1 activity are rejected by the database).

## 1. Stack (reuses what already works in the Calendly clone in `clone/`)
| layer | choice | why |
| --- | --- | --- |
| web | Next.js 15 App Router + TypeScript 5, server actions | same as the existing clone; one deploy |
| styling | Tailwind with role tokens (replica-design) | same |
| db | Postgres 16, plain SQL migrations, `pg` | exclusion + check constraints do the hard guarantees |
| auth | own scrypt + hashed session tokens (reuse `auth-core.ts`) | already built and tested; no vendor |
| payments | Stripe Checkout (card data never touches us: PCI SAQ A) | user supplies keys |
| email | Resend, `email_outbox` dev transport | reuse |
| jobs | `jobs` table + cron endpoint (reuse `queue.ts`) | hold expiry, waitlist offers, pass renewals, reminders |
| hosting | Vercel + Neon, or one Fly machine | boring |
Multi-tenant: one `organizations` row per municipality/club; every table carries `org_id` (directly or via its parent).
Access rule: no RLS. One data-layer function per query, taking `(orgId, actor)`; staff role checked per action; citizens only see rows where `account_id` is theirs. Unit tests assert cross-org and cross-account reads return nothing.

## 2. Schema summary (31 tables)
Tenancy/auth: organizations, users, staff_members, sessions, auth_tokens. People: persons.
Catalogue: locations, facilities, facility_hours, activities, activity_questions, waivers, pass_types.
Transactions: orders (cart = order in status `cart`, one open cart per account), order_lines, registrations, payments, stripe_events, pass_holdings, reservations, dropin_sessions, dropin_attendance.
Ops: email_outbox, jobs, rate_limits, audit_log.
Database guarantees: `spots_taken <= capacity` (check), no overlapping live reservations per facility (gist exclusion), one live registration per person per activity (partial unique), one open cart per account (partial unique), webhook idempotency (`stripe_events`, unique `stripe_id`).

## 3. Routes (server actions unless noted)
| route / action | does | who | flow |
| --- | --- | --- | --- |
| `/signup`, `/login`, `/verify`, `/forgot`, `/reset` (reuse) | household account, verification | public | F01 |
| `/account/family` add/edit/remove person | persons CRUD, age from birthdate | citizen | F01 |
| `/programs` GET | search + filters, only `published` | public | F01 |
| `/programs/[id]` GET | detail, spots left, eligibility per person | public | F01 F02 |
| `addToCart(activityId, personId)` | check eligibility, `update ... set spots_taken+1 where spots_taken<capacity`; if full and waitlist on, insert `waitlisted` | citizen | F01 F02 |
| `/cart` GET, `removeFromCart` | lines, hold timer (15 min) | citizen | F01 |
| `/checkout/questions` | custom answers + waiver e-sign (typed name, timestamp, waiver version) | citizen | F01 |
| `startCheckout()` | create Stripe Checkout session from the order; free orders skip Stripe | citizen | F01 |
| `POST /api/stripe/webhook` | verify signature, dedupe by event id, mark paid, confirm registrations, send receipt | Stripe | F01 |
| `/orders/[id]` GET | confirmation / receipt | citizen | F01 |
| `cancelRegistration` | policy-based refund via Stripe, release seat, offer to next in waitlist | citizen/staff | F08 |
| `/facilities`, `/facilities/[id]` | search by type/location/name, free slots from hours minus reservations | public | F03 |
| `holdReservation` | insert `held` (exclusion rejects overlaps), fee = hourly x duration | citizen | F03 |
| `/passes`, `buyPass` | pass type, auto-renew toggle, person | citizen | F04 |
| `reserveDropIn` | `taken < capacity` atomic | citizen | F05 |
| `/admin/activities` CRUD, publish, close | staff manager+ | staff | F06 |
| `/admin/activities/[id]/roster`, check-in | staff | staff | S14 |
| `/admin/facilities`, calendar | staff | staff | S15 |
| `/admin/pos` | find/create account, build order, cash or card | front_desk+ | F07 |
| `/admin/reports` + CSV export | revenue, enrolment by date | manager+ | S17 |
| `POST /api/cron` (bearer secret) | expire holds, expire waitlist offers, renew passes, reminders | cron | all |
Jobs: `expire_holds` every minute, `offer_next_waitlist` on seat release, `offer_expiry` (24 h), `renew_passes` daily, `remind_session` 24 h before.

## 4. The parts that bite
- **Seats under concurrency.** The conditional UPDATE is the lock; carts hold a seat (status `held`) with `hold_expires_at`; the expiry job returns it. Never count-then-insert.
- **Waitlist fairness.** Position by `created_at`; a freed seat becomes an `offered` registration with a 24 h window, then moves on.
- **Payment idempotency.** Webhooks arrive twice or late: dedupe on event id; a payment arriving after the hold expired must still be honoured or refunded automatically (decide: refund + email).
- **Time zones.** Facility hours and activity times are org-local; store `timestamptz`; convert day by day (reuse `availability.ts` approach) so DST days work.
- **Money.** Integer cents, one currency per org, refunds capped at paid amount.
- **Minors and privacy.** Birthdates and notes about children: minimal fields, deletion on request, no staff export of notes outside roster, audit log on staff reads of persons.
- **PCI.** Stripe-hosted checkout only; no card fields of ours. Cash is recorded, not processed.
- **Front-desk accounts without email.** `password_hash` null, `email` required: use a placeholder-free rule (staff must enter an email; otherwise a household "walk-in" person under a staff-owned account). Open question.
- **Deliverability and rate limits.** Reuse DB rate limiter on login, signup, cart actions.

## 5. Build order
1. **Vertical slice (M1):** S01, S02, S03, S08, S10 (Stripe test mode), S11. Tables: organizations, users, sessions, persons, activities, orders, order_lines, registrations, payments, stripe_events. Seed one org and 3 activities. Proves signup -> family -> program -> pay -> confirmation.
2. **Citizen must-haves (M2):** waitlist, eligibility, questions + waiver (S09), family management (S12), facility search + reservation with conflict check (S04, S05), cancellations/refunds.
3. **Staff must-haves (M3):** activities CRUD and publish (S13), roles.
4. **Should-haves (M4):** passes (S06), drop-ins (S07), roster/check-in (S14), facility calendar (S15), POS (S16), reports (S17).
5. **Could:** express registration, payment plans, per-org branding.
6. **Fixes** from `/replica-entrepreneur` once it can read reviews.
Estimate: M1 about a week, M2 to M3 a few weeks, M4 a few more.

## 6. Risks (top three)
1. Seat holding + waitlist + Stripe webhook ordering (late payment after expiry).
2. Staff POS and refunds (money states: partial refunds, cash).
3. Scope: the original's admin side is large and only known second hand; expect it to grow.
