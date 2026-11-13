# TRIPPY feature/theam — exact-reference layout implementation

**Branch:** `feature/theam` (based on the unmerged corridor booking branch `feature/corridor-operations-segment-booking-ui-20261113`).
**Status:** Isolated visual/interaction feature. **Do not merge** without approval. No production database migration or administrative permission change is part of this theme.

## The three approved image references

The user selected precisely three images to define the TRIPPY presentation. This feature re-creates their **layout and visual language**, rather than using them as merely a loose inspiration. The uploaded screenshots themselves are not used as a CSS backdrop because that would produce a static, non-interactive fake page; the TRIPPY coach and skyline are independent scalable illustrations rendered under real semantic HTML controls.

| Reference | Implementation | Visual review |
|---|---|---|
| Image 1: green Dhaka coach desktop homepage | Branded top navigation; city/bus hero; exact business tagline; Book / My Bookings / Request a New Route tabs; real pickup/dropoff/start date/vehicle/plan form; benefit strip; featured corridor; 1/3/6/12-month plan cards; four-step "How TRIPPY Works" | `https://feature-theam.trippy-corporate-mobility.pages.dev/?view=web` |
| Image 2: five phone booking screens | Same application rendered as a mobile app-like web shell; persistent Web View / Phone View toggle and automatic responsive default; bottom tabs; location autocomplete; matching corridor cards; intermediate stops, dynamic cabin map, monthly checkout | `https://feature-theam.trippy-corporate-mobility.pages.dev/?view=phone` |
| Image 3: dark Operations dashboard | Dark sidebar; route + stop panel; verified coordinates when available; real KPI cards; vehicle card; service status; passenger demand queue; charts from request records; route-planning candidates | `https://feature-theam.trippy-corporate-mobility.pages.dev/theam/admin-preview.html` (safe, read-only sample visual) |

### Real admin access

The actual Operations dashboard is not public. The user must authenticate as an authorized admin or dispatcher and meet the existing MFA enforcement. The static sample admin preview contains **no credentials**, makes **no admin API calls**, and visibly says **SAMPLE DATA**. Fake sample data does not appear in the authorized real dashboard. The real dashboard uses existing staff-only FastAPI endpoints.

### Business and engineering invariants

- The **same** live FastAPI/PostgreSQL data model serves Web View and Phone View.
- Pricing continues to come from current backend policy: illustrative bus standard fare **৳5,000 per month**; **20% eligible welcome offer** only on a first qualifying one-month booking; long plans are 25/30/35% discounts. Final checkout price remains authoritative server-side.
- Existing users, OTP and MFA, driver/location permissions, route/seat data, receipt verification and operations permissions remain unchanged.
- Real capacity depends on registered, verified vehicle seats and segment-aware occupancy; illustrative imagery is **never** labeled as a specific real assigned bus.
- "Featured" route is populated only by actual published services returned by `/api/services`. If none exists, the card explicitly says **Illustrative corridor · No live route**, and includes no invented available seats.
- Real dashboard KPIs only show values returned from authorized APIs. Metrics not implemented (e.g., CO₂ saved) display a dash and **Not calculated**, never sample percentages.
- Consumer search still supports the route-request fallback and clearly separates demo checkout from actual payment.
- The app manifest enables phone home-screen presentation. Offline bookings/checkout are **not** supported or advertised; no risky service-worker caching of authentication or fare/seat state was added.

## How to review

1. Visit the Web View preview on desktop and compare to Image 1.
2. Switch to **Phone View** in the UI (or use the direct phone link) and test route search/cards/seat selection on mobile. This is a responsive web app, not a separately deployed Android/iOS product.
3. Visit the **read-only admin visual** link and compare its navigation, cards, map, dashboard and data-density to Image 3. This is a sample view, not real fleet activity.
4. Only an authorized staff account can access the actual Operations tab. To test authenticated actions against the changed V2 backend, first connect a **dedicated DEV FastAPI** deployment and DEV Supabase. The Pages preview alone does not prove those live workflows are integrated.
5. Check visual alignment in desktop Chrome and phone Safari/Chrome, keyboard access, Bangla rendering, mobile modals, dynamic route filtering, seat checkout, and security roles.

## Key files

```text
frontend/
  index.html                     Shared customer and protected staff DOM
  src/main.js                    Existing view routing + feature/theam initialization
  src/theam.css                  Design system: desktop, phone and admin
  src/features/theam/index.js    View toggle, pricing cards, live featured route, staff cards/maps
  public/theam/coach.svg         Custom original scalable TRIPPY coach
  public/theam/dhaka-dusk.svg    Custom Dhaka-inspired skyline illustration
  public/theam/icon.svg         Branded web app icon
  public/manifest.webmanifest    Standalone home-screen metadata
  public/theam/admin-preview.html  Safe sample-only dashboard visual
  public/theam/admin-preview.css   Copy of the theme stylesheet for sample view
  test/theam.test.mjs            Screen, access, copy and pricing invariants
```

## Release guardrails

- No database migrations were applied by this theme branch.
- No backend implementation, merchant credentials, secrets, staff privileges, authentication logic, payments, or production domain aliases were changed.
- GitHub CI runs frontend tests and a compiled Vite build, plus Python API tests; the Cloudflare feature branch automatically receives an isolated Pages preview.
- The Cloudflare branch preview may be connected to older deployment settings. **Do not submit real payments, create real reservations, or assume it is linked to the DEV API** until its environment variables are separately verified.
- This branch is intentionally **not merged**. If the underlying V2 corridor branch is later merged separately, the theme may be rebased or reviewed on the approved base.

© 2026 TRIPPY LTD. All rights reserved.
