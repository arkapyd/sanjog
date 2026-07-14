# Shonjog — OSM out, Google-only search, the console cascade fixed

Seven find/replace edits: `index.html` (6) + `sw.js` (1). Every FIND verified to occur
exactly once in your uploaded file; order doesn't matter.

## What your console screenshot actually showed — two failures stacked

Your search flow was: every typing pause → **Text Search** (`places:searchText`) → on any
failure, fall through to **Nominatim**. The 403 on Text Search is a Cloud Console matter
(more below), but the cascade was the app's fault: Nominatim rejected the browser traffic
*without CORS headers*, so each Google hiccup produced the CORS wall + `net::ERR_FAILED`
spam you screenshotted — and Nominatim's usage policy forbids per-keystroke autocomplete
use anyway, so that path was living on borrowed time regardless.

After this patch: **zero requests ever leave for OSM** (test-asserted on both happy and
failure paths), the per-keystroke engine is **Autocomplete (New) with session tokens**
(keystrokes bill at $0 when the tap closes the session via Place Details — the dead
`googleAutocomplete`/`googlePlaceLocation` plumbing in your file, now actually wired), and
a Google failure prints **Google's own reason** in the red row instead of "Check Console
for 403". In testing, a referer block renders as:
*Autocomplete failed (HTTP 403) — PERMISSION_DENIED: Requests from referer … are blocked.*
That message is the remaining fix's address: whatever it names — referer restriction, API
not enabled on the key, pending verification — is the switch to flip in Cloud Console.

---

### E1 — constants: OSM viewbox and dead flags out, session-token store in

`GEO_VIEWBOX` only fed Nominatim; `lastGeoSource` only chose the attribution line; `geoBusy` and `gAutoRetryAt` were declared and never used. `gSession` holds one Autocomplete session token per field.

**FIND**
```js
const GEO_VIEWBOX = "88.10,22.90,88.65,22.30";
let geoBusy = false, lastGeoSource = "";
let gAutoRetryAt = 0;
```
**REPLACE**
```js
const gSession = { from: null, to: null };
```

---

### E2 — Autocomplete errors carry Google's real reason

**FIND**
```js
  if (!r.ok) throw new Error("autocomplete replied " + r.status);
```
**REPLACE**
```js
  if (!r.ok) throw new Error(await gErr(r, "Autocomplete"));
```

---

### E3 — Place Details errors carry Google's real reason

**FIND**
```js
  if (!r.ok) throw new Error("place details replied " + r.status);
```
**REPLACE**
```js
  if (!r.ok) throw new Error(await gErr(r, "Place details"));
```

---

### E4 — delete Text Search, Nominatim and the fallback chain; add the error reader

`googlePlaces` (Text Search) was firing on every typing pause — the most expensive Places SKU used as an autocomplete — and on any failure the code fell through to Nominatim, which now rejects browser traffic without CORS headers: that cascade was your console. `gErr` reads Google's JSON error body so a failure names itself.

**FIND**
```js
async function googlePlaces(q) {
  const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": GOOGLE_KEY, "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location" },
    body: JSON.stringify({ textQuery: q, pageSize: 5, languageCode: "en", locationRestriction: { rectangle: KOLKATA_BOUNDS } })
  });
  if (!r.ok) throw new Error("places replied " + r.status);
  return ((await r.json()).places || []).map(p => ({ name: (p.displayName && p.displayName.text) || String(p.formattedAddress || "").split(",")[0].trim() || "Unnamed place", detail: String(p.formattedAddress || "").split(",").slice(0, 3).join(",").trim(), lat: p.location && p.location.latitude, lon: p.location && p.location.longitude })).filter(p => isFinite(p.lat) && isFinite(p.lon));
}

async function nominatim(q) {
  const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=in&bounded=1&viewbox=" + GEO_VIEWBOX + "&accept-language=en&q=" + encodeURIComponent(q);
  const r = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!r.ok) throw new Error("geocoder replied " + r.status);
  return (await r.json()).map(p => ({ name: p.name || String(p.display_name || "").split(",")[0].trim() || "Unnamed place", detail: String(p.display_name || "").split(",").slice(1, 4).join(",").trim(), lat: parseFloat(p.lat), lon: parseFloat(p.lon) })).filter(p => isFinite(p.lat) && isFinite(p.lon));
}

async function geocode(q) {
  try { const places = await googlePlaces(q); lastGeoSource = "google"; return places; } catch (err) { console.warn("Google Places failed:", err); }
  const places = await nominatim(q); lastGeoSource = "osm"; return places;
}
```
**REPLACE**
```js
async function gErr(r, what) {
  let detail = "";
  try { const e = (await r.json()).error; if (e) detail = (e.status || "") + (e.status && e.message ? ": " : "") + (e.message || ""); } catch (_) {}
  return what + " failed (HTTP " + r.status + ")" + (detail ? " — " + detail : "");
}
```

---

### E5 — the keystroke path becomes Autocomplete (New) with a session token

Same UX, correct engine: the already-written-but-never-called `googleAutocomplete` goes live, one session token per typing burst. Rows carry a `placeId` instead of coordinates. The attribution is now always **Powered by Google** — required by Google's ToS when Places results are shown, and the OSM branch is gone. The red error row now prints Google's actual reason instead of "Check Console for 403".

**FIND**
```js
    if (q.length >= 3) {
      try {
        const places = await geocode(q);
        if (input.value.trim().toLowerCase() !== q) return;
        const loadingMsg = document.getElementById(`${inputId}-g-loading`);
        if (loadingMsg) loadingMsg.remove();

        let gHtml = "";
        if (places && places.length > 0) {
          places.forEach(p => { gHtml += `<div class="sugg-item" data-place="1" data-lat="${p.lat}" data-lon="${p.lon}" data-name="${esc(p.name)}"><span class="sugg-name">🌍 ${esc(p.name)}</span><span class="sugg-ward" style="text-transform:none;">${esc(p.detail)}</span></div>`; });
        } else {
          gHtml += `<div class="sugg-item sugg-attrib">Nothing found for "${esc(q)}"</div>`;
        }
        gHtml += `<div class="sugg-item sugg-attrib">${lastGeoSource === "google" ? "Powered by Google" : "Search © OpenStreetMap"}</div>`;
        list.innerHTML += gHtml;
      } catch (err) {
         const loadingMsg = document.getElementById(`${inputId}-g-loading`);
         if (loadingMsg) { loadingMsg.innerHTML = `<span class="sugg-ward" style="text-transform:none; color:#d93838; font-weight:bold;">Map API Error (Check Console for 403)</span>`; }
      }
    }
```
**REPLACE**
```js
    if (q.length >= 3) {
      try {
        if (!gSession[hiddenId]) gSession[hiddenId] = uuid();
        const places = await googleAutocomplete(q, gSession[hiddenId]);
        if (input.value.trim().toLowerCase() !== q) return;
        const loadingMsg = document.getElementById(`${inputId}-g-loading`);
        if (loadingMsg) loadingMsg.remove();

        let gHtml = "";
        if (places && places.length > 0) {
          places.forEach(p => { gHtml += `<div class="sugg-item" data-pid="${esc(p.placeId)}" data-name="${esc(p.main)}"><span class="sugg-name">🌍 ${esc(p.main)}</span><span class="sugg-ward" style="text-transform:none;">${esc(p.secondary)}</span></div>`; });
        } else {
          gHtml += `<div class="sugg-item sugg-attrib">Nothing found for "${esc(q)}"</div>`;
        }
        gHtml += `<div class="sugg-item sugg-attrib">Powered by Google</div>`;
        list.innerHTML += gHtml;
      } catch (err) {
         console.warn("Google search failed:", err);
         const loadingMsg = document.getElementById(`${inputId}-g-loading`);
         if (loadingMsg) { loadingMsg.innerHTML = `<span class="sugg-ward" style="text-transform:none; color:#d93838; font-weight:bold;">${esc(String(err.message || err).slice(0, 160))}</span>`; }
      }
    }
```

---

### E6 — tapping a suggestion resolves coordinates via Place Details

Autocomplete predictions have no coordinates, so the tap fetches them via Place Details using the same session token — which is what makes every keystroke in the burst bill at $0 — then consumes the token so the next burst mints a fresh one.

**FIND**
```js
    if (item.dataset.place) {
      const pid = PLACE_IDS[hiddenId];
      const res = setPlaceNode(NET, pid, item.dataset.name, parseFloat(item.dataset.lat), parseFloat(item.dataset.lon), {});
      list.hidden = true;
      if (!res.ok) { setLocStatus("Can't route there: " + res.reason); return; }
      hidden.value = pid; input.value = item.dataset.name; prevSel[hiddenId] = pid;
      setLocStatus(`"${item.dataset.name}" linked to: ` + linkSummary(res.links));
      render(); return;
    }
```
**REPLACE**
```js
    if (item.dataset.pid) {
      const pid = PLACE_IDS[hiddenId];
      const token = gSession[hiddenId] || uuid();
      gSession[hiddenId] = null;
      list.hidden = true;
      input.value = item.dataset.name;
      setLocStatus(`Pinning "${item.dataset.name}"…`);
      try {
        const loc = await googlePlaceLocation(item.dataset.pid, token);
        if (!isFinite(loc.lat) || !isFinite(loc.lon)) { setLocStatus("Google sent that place without coordinates — try another result."); return; }
        const res = setPlaceNode(NET, pid, item.dataset.name, loc.lat, loc.lon, {});
        if (!res.ok) { setLocStatus("Can't route there: " + res.reason); return; }
        hidden.value = pid; input.value = item.dataset.name; prevSel[hiddenId] = pid;
        setLocStatus(`"${item.dataset.name}" linked to: ` + linkSummary(res.links));
        render();
      } catch (err) { setLocStatus("Couldn't pin that place: " + String(err.message || err).slice(0, 160)); }
      return;
    }
```

---

## sw.js

### S1 — cache bump

**FIND**
```js
const CACHE = "sanjog-v13";
```
**REPLACE**
```js
const CACHE = "sanjog-v14";
```
(One higher than whatever your deployed file says, as always.)

---

## Two regressions in your upload, flagged not forced

Your consolidation reverted two earlier fixes: the **tokenised/tiered local matcher** (so
"christopher road government" again fails to surface the Christopher Rd stop, and one-word
grazes again outrank better hits) and the **instant local rendering** (the listener
debounces everything by 400 ms, so local stops lag your typing too). Both may be
deliberate simplifications — with Google-only autocomplete carrying informal queries, the
stakes are lower — so I've left your versions in place. Say the word and each comes back
as one find/replace block.

Also gone with `gAutoRetryAt`: the 60-second failure cool-off. Failures now simply retry
on the next typing burst — one cheap 403 per burst, no cascade — which is simpler and fine.

## Verified — 61/61

Full suite on your file: boot, nav tabs, deep links (`Shonjog` marker), pins/recents,
share, sorters, sticky pill, dark mode, offline — plus new: live rows from Autocomplete
with session token sent, **the same token closing the session on tap**, a fresh token per
burst, Kolkata-bounded requests, failure surfacing Google's reason with **no fallback rows,
zero OSM traffic, and the deleted Text Search endpoint never called**. Both inline scripts
pass `node --check`; the Firebase module is untouched. Runtime smoke test confirmed the
error surfacing against mocked 403/429 responses.
