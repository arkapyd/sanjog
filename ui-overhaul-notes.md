# SANJOG — UI overhaul

This round is a **whole-file replacement** of `index.html` plus one `sw.js` bump — an
overhaul touches dozens of interlocking spots, and thirty fragile find-replaces would be
riskier than a clean swap. `engine.js`, `manifest.webmanifest`, `network.json` and the
sketch image are untouched.

**Apply:** replace `index.html` with the new one, and in `sw.js` change
`const CACHE = "sanjog-v8";` → `"sanjog-v9"` (or one higher than whatever is deployed).

---

## What's new

**Features (the commonplace transit-app set):**
- **Pinned + recent journeys** — every planned journey lands as a 🕐 chip under the planner
  (last 5); the ☆ Pin button in the results header promotes it to a permanent ★ chip. Tap a
  chip to re-run it — including journeys whose endpoints were typed map places, which are
  rebuilt with their coordinates. × on a chip removes it. Stored in `localStorage`
  (device-local; not synced). Journeys from GPS "My location" aren't saved — stale
  coordinates would lie.
- **Share + deep links** — the URL always carries `?from=&to=` for the current plan (stops
  by id, typed places as `p:lat,lon,name`), so any journey is linkable and survives reload.
  The Share button uses the native share sheet where available, falling back to copying a
  summary + link ("Howrah → Satragachhi: ~70 min, ₹60 via Bus · SANJOG") with a toast.
- **Collapsible route cards** — cards now show a summary (badges, big time/fare, arrival
  estimate, changes + total walking, colour timeline); tapping expands the leg-by-leg
  details with a smooth accordion and traces the route on the map. First card starts open.
- **Arrival time** — "arrive ~6:42 pm" computed from now + journey time, on every card.
- **Install button** — appears in the masthead when Chrome/Android offers installability
  (`beforeinstallprompt`); iOS never fires that event, so there it stays hidden and
  installing remains Share-sheet → Add to Home Screen.
- **Offline banner** — a slim strip under the header when the connection drops: stop search
  and planning keep working from cache, map search doesn't.

**Look and density (the "gutter space" complaint):**
- Content column widened 680 → 960px, and **route cards go two-up** on screens ≥720px.
- Masthead slimmed to one row: title left, ticker + install right; vertical padding nearly
  halved.
- On desktop the From / swap / To / Find-routes controls sit on **one line**.
- Panel, cards, suggestion lists and legend chips are now **glass** — translucent aged
  paper with backdrop blur, so the Howrah sketch reads through everything. Falls back to
  near-solid on browsers without `backdrop-filter`.
- Rounded corners grew (11–16px), buttons got press/hover states (the swap arrow spins),
  cards lift on hover, chips tightened, inputs taller with soft focus rings.
- `prefers-reduced-motion` kills all transitions and animations.

## What deliberately didn't change

The whole logic core is verbatim from the previous version: network loading + validation
banner, stop autocomplete with bold-match highlighting, Google-Places-first geocoding with
the OSM fallback and attribution, GPS location linking, place lifecycle and cleanup, the
planner integration (including direct rickshaws), the schematic map with dashed virtual
legs, the taxi hint, and the legend. Your API key rides along unchanged.

## Verified

- **31/31 jsdom DOM tests** against the real 1,227-stop network: boot + default plan, card
  selection/accordion, arrival times, recents persistence, pin/unpin (and pin removing the
  recent), shortcut chips including typed-place reconstruction and × deletion, URL deep
  links for both stop ids and `p:` places boot-planning correctly, share clipboard fallback
  content, swap, offline banner, and the data-warning banner still reporting the 3 known
  self-loop edges.
- Inline JS and `sw.js` parse clean (`node --check`).
- Not verifiable headlessly: the visual layer itself (glass blur, grid reflow, animations).
  First look on deploy: plan a journey on desktop to see the two-column cards, and tap a
  card on mobile to feel the accordion.
