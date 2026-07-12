# SANJOG — Google Places as the geocoder

Three edits: `index.html` (2) and `sw.js` (1). They apply on top of the place-search patch;
every FIND was verified to occur exactly once in the current files.

**Why Places API (New) Text Search and not the Geocoding API:** the classic Geocoding web
service (`maps.googleapis.com/maps/api/geocode/json`) sends no CORS headers — a static
GitHub Pages app cannot call it from the browser at all. Text Search (New) at
`places.googleapis.com/v1/places:searchText` is CORS-enabled, built for browser keys, and is
also simply better at informal queries ("peter cat", "phuchka near south city"). Results are
hard-bounded to the same greater-Kolkata rectangle as before, and the field mask requests
only name + address + coordinates, which keeps every call on the **Text Search Pro SKU:
5,000 free calls/month, then $32 per 1,000**. One call fires per explicit search tap/Enter —
deliberately not per keystroke (that's the Autocomplete SKU with session tokens; can be
added later if you want it).

**Nominatim stays as an automatic fallback.** If the Google call fails for any reason —
key restrictions still being tuned, Places API (New) not yet enabled, quota exhausted,
opening the file locally where no referrer is sent — the search silently retries via
OpenStreetMap and the attribution row switches accordingly. The app never hard-breaks while
you fiddle with the key. The console logs which path was taken.

---

## index.html

### G1 — swap the geocoder: Google primary, OSM fallback

**FIND**
```js
const GEO_VIEWBOX = "88.10,22.90,88.65,22.30";   // greater Kolkata: lon,lat,lon,lat
let geoBusy = false;
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

async function geocode(q) {
  const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5" +
              "&countrycodes=in&bounded=1&viewbox=" + GEO_VIEWBOX +
              "&accept-language=en&q=" + encodeURIComponent(q);
  const r = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!r.ok) throw new Error("geocoder replied " + r.status);
  return (await r.json()).map(p => ({
    name: p.name || String(p.display_name || "").split(",")[0].trim() || "Unnamed place",
    detail: String(p.display_name || "").split(",").slice(1, 4).join(",").trim(),
    lat: parseFloat(p.lat), lon: parseFloat(p.lon)
  })).filter(p => isFinite(p.lat) && isFinite(p.lon));
}
```
**REPLACE**
```js
const GOOGLE_KEY = "AIzaSyDshZXBoGtvsa1P2yammkPoGZ8fJuI6xIU";
const KOLKATA_BOUNDS = { low:  { latitude: 22.30, longitude: 88.10 },
                         high: { latitude: 22.90, longitude: 88.65 } };  // greater Kolkata
const GEO_VIEWBOX = "88.10,22.90,88.65,22.30";   // same box, Nominatim fallback format
let geoBusy = false, lastGeoSource = "";
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

async function googlePlaces(q) {
  const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_KEY,
      // fields kept to the Pro SKU: name, address, coordinates — nothing pricier
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location"
    },
    body: JSON.stringify({
      textQuery: q, pageSize: 5, languageCode: "en",
      locationRestriction: { rectangle: KOLKATA_BOUNDS }
    })
  });
  if (!r.ok) throw new Error("places replied " + r.status);
  return ((await r.json()).places || []).map(p => ({
    name: (p.displayName && p.displayName.text) ||
          String(p.formattedAddress || "").split(",")[0].trim() || "Unnamed place",
    detail: String(p.formattedAddress || "").split(",").slice(0, 3).join(",").trim(),
    lat: p.location && p.location.latitude,
    lon: p.location && p.location.longitude
  })).filter(p => isFinite(p.lat) && isFinite(p.lon));
}

async function nominatim(q) {
  const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5" +
              "&countrycodes=in&bounded=1&viewbox=" + GEO_VIEWBOX +
              "&accept-language=en&q=" + encodeURIComponent(q);
  const r = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!r.ok) throw new Error("geocoder replied " + r.status);
  return (await r.json()).map(p => ({
    name: p.name || String(p.display_name || "").split(",")[0].trim() || "Unnamed place",
    detail: String(p.display_name || "").split(",").slice(1, 4).join(",").trim(),
    lat: parseFloat(p.lat), lon: parseFloat(p.lon)
  })).filter(p => isFinite(p.lat) && isFinite(p.lon));
}

// Google first (better with informal names); OSM if Google is unreachable,
// unconfigured, over quota, or blocked by key restrictions.
async function geocode(q) {
  try {
    const places = await googlePlaces(q);
    lastGeoSource = "google";
    return places;
  } catch (err) {
    console.warn("Google Places failed, falling back to OpenStreetMap:", err);
  }
  const places = await nominatim(q);
  lastGeoSource = "osm";
  return places;
}
```

### G2 — attribution follows whichever service answered

(Google's terms require "powered by Google" when Places results are shown without a Google map; OSM requires its credit line. This row now shows the right one.)

**FIND**
```js
          `<div class="sugg-item sugg-attrib">search \u00a9 OpenStreetMap contributors</div>`
```
**REPLACE**
```js
          `<div class="sugg-item sugg-attrib">${lastGeoSource === "google" ? "powered by Google" : "search \u00a9 OpenStreetMap contributors"}</div>`
```

---

## sw.js

### G3 — cache bump

**FIND**
```js
const CACHE = "sanjog-v5";
```
**REPLACE**
```js
const CACHE = "sanjog-v6";
```

(As before: if your deployed file shows a different version, just go one higher than
whatever is there — installed users, including the Play Store TWA, keep the old cached
shell otherwise.)

---

## Do this in Google Cloud Console before/right after pushing

The key ships in a public repo and a public page — that is *normal* for Maps Platform
browser keys, but only safe once restricted. Credentials → your key:

1. **Application restrictions → Websites**: add `https://arkapyd.github.io/*`
   (that referrer restriction is what stops a scraped key working from anywhere else).
2. **API restrictions**: restrict the key to **Places API (New)** only.
3. Make sure **Places API (New)** is the enabled toggle — the legacy "Places API" is a
   different product that new projects can't even enable. If it's off, calls 403 and the
   app quietly serves OSM results; the browser console will show the real error.
4. **Set a quota cap** (Places API (New) → Quotas → e.g. a few hundred requests/day).
   Budget alerts only notify — they don't stop billing; a hard quota does.
5. Optional hygiene: the key has now travelled through chats and will sit in git history —
   after restricting, regenerating it in the console is one click and nothing else changes.

## Verified

- All 3 FINDs occur exactly once; all patched JS parses (`node --check`).
- 17/17 mocked-fetch tests on the exact shipped code: request shape (endpoint, key header,
  Pro-only field mask, Kolkata rectangle, pageSize), response mapping (displayName
  preferred, address-head fallback, coordinate-less results filtered), 403 → OSM fallback,
  network-error → OSM fallback, empty Google results stay Google (no pointless fallback),
  and both-services-down surfaces the friendly error.
- Live calls to `places.googleapis.com` aren't reachable from this sandbox — first check on
  deploy: search "peter cat", confirm results say **powered by Google** at the bottom.
