# Recon map: ActiveNet (ACTIVE Network), web, citizen portal + staff back office

Method: public sources only (vendor marketing pages, municipal help pages, Capterra/GetApp listings), read through
web search summaries. No account, no screenshots, no vendor help centre or demo reached. Everything below is
INFERRED from those summaries; confidence is marked. `screens/` is empty on purpose: layout diff is not possible yet.
Files live in `replica/activenet/` so the Calendly recon in `replica/` stays intact.

## 1. Scope (proposed, needs your yes)
- App/platform: ActiveNet, web (public participant portal + staff back office). Not the mobile app, not Camp/League/Club modules.
- Slice: the core loop users pay for = find a program, register a family member, pay, get confirmation; plus facility reservation and the staff screens that configure them.
- Audience (assumed): a municipality, club or recreation centre that wants its own registration software.
- "Identical" means same functions and flow. Not the original's name, logo, copy, icons, code or customer data.

## 2. Sources
| source | URL | gives |
| --- | --- | --- |
| Product overview | https://www.activenetwork.com/parks | modules, express registration, AI tools |
| Recreation mgmt page | https://www.activenetwork.com/active-recreation-management | feature list |
| Drop-in blog | https://www.activenetwork.com/blog/new-in-activenet-manage-drop-in-activities-with-recreation-management-software | drop-in reservations, attendance |
| Club/POS page | https://info.activenetwork.com/solutions/active-net/club-management-software | point of sale, room reservations (dated) |
| League page | https://info.activenetwork.com/solutions/active-net/league-management-software | leagues (out of scope) |
| Capterra | https://www.capterra.com/p/115451/ACTIVE-Net/ | strengths and admin pain points |
| GetApp | https://www.getapp.com/customer-management-software/a/active-net/ | facility filters |
| Kitchener help | https://www.kitchener.ca/en/recreation-and-sports/activenet-questions.aspx | account rules (email, 13+) |
| Niagara Falls help | https://niagarafalls.ca/recreation-culture-and-community/recreation-programs-and-facilities/create-an-activenet-account/ | family list at checkout |
| Haldimand | https://www.haldimandcounty.ca/recreation-culture-community/recreation/programs-and-registration/ | family members, waitlist |
| St. Mary's | https://www.townofstmarys.com/recreation-community-culture/programs-activities/activenetregister-for-programs/ | memberships, auto-renew pass |
| EPD | https://www.epd.org/news/get-active | waitlist counted at checkout, confirmation email |
| Fontana | https://arts.fontanaca.gov/159/Registration-Information | family members only after email verification |

## 3. Screen inventory (inferred)
| ID | screen | how you get there | purpose | key components | states to build |
| --- | --- | --- | --- | --- | --- |
| S01 | Sign up / sign in | portal header | household account | email+password form, verification notice | error, unverified, locked |
| S02 | Programs search | portal home | find activities | search, filters (age, day, location, category), result cards | empty, loading, no results |
| S03 | Program detail | click a result | dates, fee, spots, rules | info panel, fee table, "Add to cart" / "Join waitlist" | full, closed, not eligible |
| S04 | Facility search | portal nav | find rooms/courts | filter by type/location/name, availability calendar | empty, conflict |
| S05 | Facility reservation | pick a slot | reserve with times | date/time picker, purpose, fee | conflict, outside hours |
| S06 | Memberships / passes | portal nav | buy a pass | pass list, auto-renew toggle | expired, renewing |
| S07 | Drop-in reservation | program with drop-in | reserve a spot | session list, spots left | full |
| S08 | Cart | header cart | review items | line per item, participant picker, remove, timer (inferred) | empty, hold expired |
| S09 | Questions and waiver | checkout step | custom questions, e-sign | question form, waiver text, signature box | missing answer |
| S10 | Payment | checkout step | pay | card form, totals, credit/balance | declined, failure |
| S11 | Confirmation | after pay | receipt | summary, email sent | waitlist variant |
| S12 | My account / family | account menu | people and history | family list, add person, past registrations, receipts | none yet |
| S13 | Staff: activities | back office | create/edit activity | name, dates, fee, capacity, eligibility, waitlist rules | draft/published |
| S14 | Staff: roster and attendance | back office | manage participants, drop-ins | roster table, check-in | empty |
| S15 | Staff: facilities and calendar | back office | define spaces, see bookings | resource list, day/week calendar | conflict |
| S16 | Staff: point of sale | front desk | walk-in sale for a customer | customer lookup, cart, cash/card | refund |
| S17 | Staff: reports | back office | revenue, enrolment | report list, date filter, export | empty |
Confidence: S01, S02, S03, S08, S09, S10, S11, S12 high; S04, S05, S06, S07 medium; S13 to S17 low to medium (admin side seen only through reviews).

## 4. Flows
- F01 Citizen registers a family member: S01, S12 (add person), S02, S03, S08 (pick participant), S09, S10, S11. Edge: program full (waitlist), person not eligible, hold expires, payment declined, email unverified.
- F02 Waitlist: S03 "Join waitlist", S08/S10 checkout, S11. A waitlist entry counts only once checkout is clicked (EPD). Edge: spot opens, offer expires.
- F03 Reserve a facility: S04, S05, S08, S10, S11. Edge: double booking, outside open hours, fee by hour.
- F04 Buy a pass: S06, S08, S10, S11. Auto-renew choice, then pick family member.
- F05 Drop-in: S07, S08 or free, S11. Edge: capacity.
- F06 Staff publishes an activity: S13. Edge: fee changes after registrations exist.
- F07 Staff front-desk sale: S16. Edge: refund, no email on file (staff creates the account).
- F08 Cancel/transfer a registration: staff or citizen, refund policy (inferred, low).
Happy-path clicks for F01 (estimate): about 10 after sign-in. Target: 6.

## 5. Components
Header with cart and account menu; filter sidebar; program/result card; fee table; participant picker; cart line; custom-question renderer; waiver with signature; payment form; calendar day/week grid; status badges (open, full, waitlist, closed); data table with export; confirmation banner; toasts; modal confirm.

## 6. Inferred data model
- Organization (tenant), Location, Facility (type, location, hours, hourly fee). high
- Account (email, password, verified) 1..n Person (household member: name, birthdate, medical/notes). high (Haldimand, Fontana)
- Activity (category, dates, schedule, fee, capacity, min/max age, waitlist on/off, status) 1..n Session. high
- Registration (activity, person, status: confirmed | waitlisted | cancelled, price, answers, waiver_signed_at). high
- Pass/Membership (type, fee, auto_renew) and PassHolding (person, valid_to). medium
- Reservation (facility, start, end, account, status, fee). medium
- Order (account, lines, total, payment status) and Payment. high
- DropInSession (activity, capacity) and Attendance. medium
- Question, Waiver. medium. StaffUser with role. medium. Receipt/Email log. high

## 7. What cannot be cloned (skip)
The vendor's customer network and municipal data; its payment-processor contracts and PCI certification (use Stripe); its AI tools and any proprietary reports; the mobile apps; Camp/League/Club/Campus modules; accounting-system integrations (GL export) for now; tax/government forms.

## 8. Size
17 screens, 8 flows, about 14 entities. Hard parts: (1) capacity and waitlist under concurrency plus cart holds; (2) payments with Stripe, refunds, auto-renewing passes (PCI scope stays with Stripe); (3) facility reservation rules (hours, overlaps, fees) and staff POS. Size: L (a quarter) for the full slice, M for the citizen loop F01 to F03 alone. Recommend M first.
