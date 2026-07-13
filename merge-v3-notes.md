# SANJOG — your changes merged with the v2 feature set

**Apply:** replace `index.html` with this one; `sw.js` goes to **v10** (already in the
bundle — or one higher than whatever is deployed). Nothing else changes.

## Everything of yours is kept — and now covered by tests

- **Dark mode**: the `html.dark` palette, the `prefers-color-scheme` auto-detection, the
  🌙/☀️ toggle with `localStorage` persistence, and the sketch-darkening blend mode.
- **Sticky journey pill**: appears past 280px of scroll when routes exist, forced pale
  beige in dark mode; now filled with "📍 From → 🏁 To" exactly as you wired it.
- **Sorters** (Fastest / Cheapest / Least Walk): your sort logic untouched. One addition:
  the row now re-hides when a plan fails or is cleared — previously it stayed up stale.
- **Night-bus warning** (22:00–04:00 + bus leg), your button styling fixes, your local-stop
  cap of 8, your loading row, your anti-race guard, your error row styling.

## The v2 features, rebuilt around your file

Clipping fix (panel out from under the header — it was a stacking-context trap), the
**Home / About us / Careers** ribbon with placeholder copy (`[Edit this page: …]` marks the
bits to replace; Home is a plain `./` refresh), **instructive empty defaults** with guided
empty-states, and the **Google Map** replacing the SVG (sepia-styled greater Kolkata,
selected route as coloured polylines with dotted walking legs, A/B markers, interchange
dots, honest offline note). Console reminder: the key's API restrictions need **Maps
JavaScript API** added alongside Places API (New), or the map area will tell you so.

## Two judgment calls inside your live-search code — flagged openly

1. **Your per-keystroke `geocode()` (Text Search) became the fallback, not the primary.**
   Text Search Pro bills $32/1,000 once past 5,000/month — every typing pause was a billed
   call. The merged version keeps your exact UX (loading row, 🌍 rows, wording, error row)
   but feeds it from **Autocomplete (New) with session tokens**: all keystrokes in a
   session bill at $0 when the pick closes the session via a Place Details call for
   `location,displayName`. Your Text Search → OSM flow now runs automatically if
   Autocomplete ever fails (bad restriction, quota), so nothing you built is gone — it's
   the safety net.
2. **Local stops are instant again.** Your listener debounced everything by 400 ms, but
   your own comment says "INSTANT LOCAL SEARCH" — so local matching now renders on every
   keystroke and only the Google call waits your 400 ms.

If either call is wrong for you, both are single-line reverts — say the word.

## Verified — 52/52 jsdom tests on the merged file

All of the v2 suite (empty boot, nav views, live suggestions with session-token capture,
same-token session close, fresh token per burst, plan/pin/share/deep-links, offline) plus
new coverage of yours: loading row instant, local rows instant, sorters hidden→shown→
reordering by fare→active-state handoff, sticky pill content + scroll show/hide, dark-mode
toggle + persistence, and the failure path falling back to your Text Search rows which
still pin a routable place. Inline JS parses clean.

**Headless can't verify:** the map's actual rendering and dark mode's look over the sketch.
First checks on deploy: map paints sepia, dark toggle at night, type "peter cat".
