# Smart Dhaka location autocomplete — team runbook

## Overview

Pickup area and Destination now use the **same accessible autocomplete**. Suggestions appear after the first character (e.g. `B` → Banani, Badda, Bashundhara), refine as the user types (`Ba`, `Ban`) and support English, Bangla, Bengali numerals and common spellings.

The two original form keys, `pickup` and `office`, remain unchanged; demo booking, route requests, booking, authentication and payments have not been modified.

## Suggestion sources (priority and accuracy)

1. **Curated local index:** 262 common Dhaka/Greater Dhaka names, plus 18 Uttara sector choices. Includes neighborhoods, residential and business areas, well-known roads, metro stations, popular stops, hospitals and landmarks. It loads immediately, including if the map service is offline. It is **not** an authoritative gazetteer or a list of legally approved boarding points. Curated suggestions have no fabricated coordinates.
2. **Approved TRIPPY stops:** The public, bounded endpoint `GET /api/locations/stops?q=...` returns up to eight stops from `app.stops` **only where `approved AND active`**. Coordinates are the values already verified by operations. It does not disclose private draft stops, riders, vehicles or addresses.
3. **Optional MapTiler geocoding:** When the browser-safe `VITE_MAPTILER_KEY` is configured, three or more characters trigger a bounded MapTiler forward-geocoding request. It is restricted to `country=bd` and approximate Greater Dhaka bbox `90.25,23.63,90.57,23.96`; live results include coordinates and provider attribution. The map search improves coverage of individual streets, roads and POIs beyond the built-in index, but no provider guarantees every address or bus stop.

### Operational distinction

**Finding a location does not guarantee a TRIPPY vehicle will stop there.** Real rides still require a published, verified route and approved boarding stop. The application preserves a chosen detailed place in the input for user display but, for known curated areas/stops, searches published real-service corridors by their broader zone (e.g. Banani Road 11 → Banani). The demo bus remains a clearly labelled simulation.

## Production / DEV configuration

This feature requires **no migration, no new npm dependency and no mandatory map subscription**.

The approved-stop endpoint works against the existing Supabase/Postgres `app.stops` table after backend deployment. If no stops are approved, the local index still works.

To enable live geocoding, set `VITE_MAPTILER_KEY` as a **public browser key** in the respective frontend environment, with allowed HTTP origins configured separately for DEV branch previews and PRD, and usage quotas/budget alerts. A `VITE_*` key is visible to customers; it must never be a secret or an unrestricted privileged account key. Review MapTiler pricing, business-use rights, coverage, and privacy terms before activation. Any queries sent to MapTiler will be processed by that third party.

Official provider documentation:
- https://docs.maptiler.com/cloud/api/open-api/ (forward geocoding, `bbox`, `country`, `autocomplete`, `limit`)
- https://docs.maptiler.com/guides/developer/credentials/api-key/ (restrict API keys by allowed HTTP origin)
- https://www.maptiler.com/copyright/

## Accessibility and performance

- Native text inputs retain copy/paste and freeform editing.
- The results use combobox/listbox roles, `aria-expanded`, `aria-activedescendant`, and clear active option state. Arrow keys navigate, Enter selects and Escape dismisses. All results have large touch targets.
- First-character matches are shown locally with no network request. Official-stop requests begin at 2 characters, and optional geocoding at 3 characters. Network requests are debounced by 350 ms and stale responses cannot overwrite newer suggestions.
- Unavailable geocoding/stop endpoints **never block** local suggestions, booking or the real-service catalog.
- No raw HTML is injected from location/provider data; all text is inserted safely with `textContent`.
- A selected result with verified coordinates carries those coordinates in the input's client-side dataset, but they are **not** silently used to enable passenger tracking or arbitrary pickup points.

## QA checklist

- Type `B`, `Ba`, `Ban`, `bananee`, `Bashundhara`, `shahbagh`.
- Switch to Bangla and type `বনানী`, `উত্তরা`, `উত্তরা সেক্টর ৭`; check both English and Bangla numerals.
- Search for `Mirpur 10`, `Motijheel Metro Station`, `Satmasjid Road`, `Banani Road 11`.
- Check one-character instant dropdown, arrow navigation, Enter selection, Escape and outside-tap dismissal.
- Verify that choosing a specific road searches by its relevant operating zone but **does not advertise unapproved real stops**.
- Mobile: verify the result panel fits the viewport, touch targets and scrolling on Android/iOS.
- Toggle DEV map key on/off. Unconfigured and unavailable providers must not break the local index.
- Confirm a real route remains verified and billable only through existing booking checks, and the Demo Bus stays demo-only.
- Test the approved-stop endpoint returns only verified, active stop names.

## Known limits / future enhancements

The local directory is intentionally a **curated starter catalog**, not every alley and building in Dhaka. Additional local businesses and roads depend on the optional third-party provider or verified admin stop registration. Road-level routing and nearest-approved-stop snapping remain a separate, geospatial feature, not part of autocomplete.

To extend the offline catalog, edit `frontend/src/features/locations/catalog.js` as a reviewed PR and add bilingual synonyms. Do not invent coordinates or mark unofficial locations as approved bus stops.
