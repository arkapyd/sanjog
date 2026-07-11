# SANJOG সংযোগ — Kolkata, every mode, one journey

A community journey planner for Kolkata. Pick two stops and see which modes
to take (metro, bus, tram, ferry, shared auto, rickshaw), roughly how long
it looks, and what it costs — compared as Fastest / Cheapest / Fewest changes.

All network knowledge lives in **one data file: `network.json`**. Nobody needs
to touch code to add their ward.

## Files

| File | What it is |
|---|---|
| `index.html` | The whole app UI (also contains a built-in copy of the network as an offline fallback) |
| `network.json` | **The network. This is the only file contributors edit.** |
| `engine.js` | Routing engine (validation + journey planning), shared by the app and `test.js` |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | PWA plumbing: offline support, installability, Play Store packaging |
| `test.js` | Run `node test.js` to validate `network.json` and plan sample journeys |

## Run it

Open `index.html` in a browser — that's it. (Opened as a local file it uses the
built-in network copy; hosted, it loads `network.json` fresh.)

## Deploy on GitHub Pages

1. Create a repo and upload all files to the root.
2. Settings → Pages → Deploy from a branch → `main`, `/ (root)`.
3. Your app is live at `https://<user>.github.io/<repo>/`. Users can Install
   it from the browser menu (it's a PWA: works offline after first visit).
   The "Use my location" option needs HTTPS and the user's permission —
   both satisfied on GitHub Pages, but not when opening the file locally.

## Add your ward's data (the whole point)

Edit **`network.json`** — in the GitHub web editor is fine. Three sections:

**`stops`** — places where people board or change:

```json
{ "id": "behala", "name": "Behala Chowrasta", "ward": "South-West",
  "lat": 22.4987, "lon": 88.3097 }
```

- `id`: unique, lowercase letters/digits/`_`/`-` only. Never reuse or rename
  an existing id (edges refer to them).
- `ward` groups stops in the pickers — use your ward/neighbourhood name.
- `lat`/`lon` (optional, recommended): coordinates. Long-press the spot in
  Google Maps and copy the numbers. Stops with coordinates power the
  "Use my location" option, which links a user to their nearest stops by
  walking time. Provide both or neither.

**`edges`** — direct connections between two stops. Every edge is
**automatically two-way**; write it once.

```json
{ "from": "tolly", "to": "behala", "mode": "auto" }
```

- `mode` must exist in the `modes` section.
- `line` (optional): route name/number, e.g. `"Bus 12C/2"`.
- `min` and `fare` (optional): if you leave them out, the mode's
  `defaultMin`/`defaultFare` are used and the app shows them with a `~`
  ("typical estimate"). **So you can map connectivity first and let
  timings/fares come later** — exactly the ward-by-ward plan.
- `color` (optional): hex override, used for metro line colours.

**`modes`** — add a new mode of transport (e.g. toto/e-rickshaw) by copying an
existing entry and setting `label`, `icon` (a 1–2 letter code shown on mode tiles, e.g. "M"), `color`, `wait` (typical minutes
until one turns up), `defaultMin`, `defaultFare`.

**Rules of thumb**

1. Connect your ward to the existing network with at least one edge, or it's
   an island no journey can reach.
2. Bump `version` and `updated` at the top so users can see data freshness.
3. Mistakes won't crash the app: broken edges are skipped and a yellow banner
   (plus the browser console, F12) lists exactly what to fix.
4. If you have Node available, `node test.js` validates the file and plans
   sample journeys before you commit.

## Publishing to Google Play (summary)

Host the PWA (above), then package it as a Trusted Web Activity with
[PWABuilder](https://www.pwabuilder.com) and upload the generated `.aab` in
Google Play Console. New personal developer accounts must run a closed test
with 12 opted-in testers for 14 continuous days before applying for
production access.

---

Timings and fares in the sample data are indicative, not live. SANJOG is a
community project and is not affiliated with WBTC, Metro Railway, or any
transport operator.
