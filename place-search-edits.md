# SANJOG — type any place, route to it

Typed map search, Google-Maps style: stop suggestions stay instant and local; below them a
**"🔍 Search the map for …"** row (also triggered by **Enter**) geocodes the text via
OpenStreetMap Nominatim, bounded to greater Kolkata. Picking a result injects it into the
network as a virtual stop, gap-filled to its nearest real stops with **walk links always,
plus rickshaw links when the hop is under 1.2 km** — the planner then weighs them like any
other edge, so Fastest tends to grab the rickshaw and Cheapest keeps the free walk. Both
From and To can be typed places; routes between two typed places work.

**12 edits: `engine.js` (4), `index.html` (7), `sw.js` (1 + cache bump).**
Every FIND was machine-verified to occur exactly once in your files — checked against both
the pre-theme and the themed `index.html`, so these apply cleanly either way, in any order.

Design decisions worth knowing before you tweak:

- **Search fires on explicit tap/Enter, not per keystroke.** Nominatim's usage policy caps
  requests at 1/second and explicitly forbids client-side as-you-type autocomplete — apps
  that do it get blocked. This flow (one request per deliberate search) is compliant, free,
  needs no API key, and works from GitHub Pages (the Referer header serves as attribution).
- The tiny **"search © OpenStreetMap contributors"** row under results is required
  attribution — please keep it.
- Results are bounded to a viewbox covering Howrah–Rajarhat / Barrackpore–Joka
  (`88.10–88.65 E, 22.30–22.90 N`); widen `GEO_VIEWBOX` if the network grows beyond it.
- Typed places auto-clean: pick a normal stop and the virtual node and all its edges are
  removed; swap is safe; a place that geocodes >30 km from the network is refused with the
  distance and the nearest stop named.
- Rickshaw gap-fill model: ~7.8 km/h pace, fare `max(₹25, ~₹25/km street distance)`, both
  marked `~` approximate; the 1.2 km ceiling is `RICKSHAW_MAX_M` in `engine.js`.
- The service worker gets a guard so cross-origin calls (the geocoder) are never trapped in
  the app-shell cache.

---

## engine.js

### E1 — constants: rickshaw pace + 1.2 km ceiling
**FIND**
```js
// ---- "My location" support -------------------------------------------
// The user's position becomes a temporary stop ("_myloc") joined to the
// nearest coordinate-bearing stops by walking links. Pure data injection:
// the planner itself needs no changes.

const LOC_ID = "_myloc";
const WALK_M_PER_MIN = 75;    // ~4.5 km/h
const ROUTE_FACTOR = 1.3;     // straight-line -> street distance fudge
```
**REPLACE**
```js
// ---- Virtual place support ---------------------------------------------
// "My location" and typed map places become temporary stops joined to
// nearby coordinate-bearing stops by walk links — plus rickshaw links for
// hops under RICKSHAW_MAX_M, so the planner can weigh both. Pure data
// injection: the planner itself needs no changes.

const LOC_ID = "_myloc";
const WALK_M_PER_MIN = 75;    // ~4.5 km/h
const RICK_M_PER_MIN = 130;   // ~7.8 km/h — cycle-rickshaw pace
const RICKSHAW_MAX_M = 1200;  // offer a rickshaw for gaps below this
const ROUTE_FACTOR = 1.3;     // straight-line -> street distance fudge
```

### E2 — `clearLocationNode` generalises to `clearPlaceNode`
**FIND**
```js
function clearLocationNode(NET) {
  if (!NET.stops[LOC_ID]) return;
  delete NET.stops[LOC_ID];
  delete NET.adj[LOC_ID];
  for (const id in NET.adj) NET.adj[id] = NET.adj[id].filter(e => e.to !== LOC_ID);
}
```
**REPLACE**
```js
function clearPlaceNode(NET, id) {
  if (!NET.stops[id]) return;
  delete NET.stops[id];
  delete NET.adj[id];
  for (const sid in NET.adj) NET.adj[sid] = NET.adj[sid].filter(e => e.to !== id);
}

function clearLocationNode(NET) { clearPlaceNode(NET, LOC_ID); }
```

### E3 — `setLocationNode` generalises to `setPlaceNode` (walk + sub-1.2 km rickshaw links)
**FIND**
```js
function setLocationNode(NET, lat, lon, opts = {}) {
  const maxLinks    = opts.maxLinks    || 3;      // link to up to this many stops
  const linkRadiusM = opts.linkRadiusM || 2500;   // within this radius
  const giveUpM     = opts.giveUpM     || 30000;  // beyond this: not our city

  clearLocationNode(NET);
  if (!NET.modes.walk)
    return { ok: false, reason: 'this network defines no "walk" mode, which location linking needs.' };

  const cands = [];
  for (const id in NET.stops) {
    const s = NET.stops[id];
    if (typeof s.lat === "number" && typeof s.lon === "number")
      cands.push({ id, d: haversineMeters(lat, lon, s.lat, s.lon) });
  }
  if (!cands.length)
    return { ok: false, reason: "no stops in this network have coordinates yet." };

  cands.sort((a, b) => a.d - b.d);
  if (cands[0].d > giveUpM)
    return { ok: false, reason: `you're about ${Math.round(cands[0].d / 1000)} km from the mapped network ` +
                                `(nearest stop: ${NET.stops[cands[0].id].name}).` };

  let picked = cands.filter(c => c.d <= linkRadiusM).slice(0, maxLinks);
  if (!picked.length) picked = [cands[0]];   // far-ish but reachable: link the nearest

  NET.stops[LOC_ID] = { name: "My location", ward: "", lat, lon };
  NET.adj[LOC_ID] = [];
  const links = [];
  for (const c of picked) {
    const min = Math.max(1, Math.round(c.d * ROUTE_FACTOR / WALK_M_PER_MIN));
    const edge = { mode: "walk", line: "Walk", color: NET.modes.walk.color,
                   min, fare: 0, minApprox: true, fareApprox: false, key: "walk|Walk" };
    NET.adj[LOC_ID].push({ to: c.id, ...edge });
    NET.adj[c.id].push({ to: LOC_ID, ...edge });
    links.push({ id: c.id, min, distM: Math.round(c.d) });
  }
  return { ok: true, links };
}
```
**REPLACE**
```js
function setPlaceNode(NET, id, name, lat, lon, opts = {}) {
  const maxLinks     = opts.maxLinks     || 3;      // link to up to this many stops
  const linkRadiusM  = opts.linkRadiusM  || 2500;   // within this radius
  const giveUpM      = opts.giveUpM      || 30000;  // beyond this: not our city
  const rickshawMaxM = opts.rickshawMaxM || RICKSHAW_MAX_M;

  clearPlaceNode(NET, id);
  if (!NET.modes.walk)
    return { ok: false, reason: 'this network defines no "walk" mode, which place linking needs.' };

  const cands = [];
  for (const sid in NET.stops) {
    if (sid[0] === "_") continue;                   // never chain virtual nodes together
    const s = NET.stops[sid];
    if (typeof s.lat === "number" && typeof s.lon === "number")
      cands.push({ id: sid, d: haversineMeters(lat, lon, s.lat, s.lon) });
  }
  if (!cands.length)
    return { ok: false, reason: "no stops in this network have coordinates yet." };

  cands.sort((a, b) => a.d - b.d);
  if (cands[0].d > giveUpM)
    return { ok: false, reason: `that's about ${Math.round(cands[0].d / 1000)} km from the mapped network ` +
                                `(nearest stop: ${NET.stops[cands[0].id].name}).` };

  let picked = cands.filter(c => c.d <= linkRadiusM).slice(0, maxLinks);
  if (!picked.length) picked = [cands[0]];   // far-ish but reachable: link the nearest

  NET.stops[id] = { name, ward: "", lat, lon };
  NET.adj[id] = [];
  const links = [];
  for (const c of picked) {
    const walkMin = Math.max(1, Math.round(c.d * ROUTE_FACTOR / WALK_M_PER_MIN));
    const walk = { mode: "walk", line: "Walk", color: NET.modes.walk.color,
                   min: walkMin, fare: 0, minApprox: true, fareApprox: false, key: "walk|Walk" };
    NET.adj[id].push({ to: c.id, ...walk });
    NET.adj[c.id].push({ to: id, ...walk });

    // short hop: also offer a rickshaw for the same gap, planner picks
    let rickMin = null;
    if (NET.modes.rickshaw && c.d <= rickshawMaxM) {
      const md = NET.modes.rickshaw;
      rickMin = Math.max(2, Math.round(c.d * ROUTE_FACTOR / RICK_M_PER_MIN));
      const fare = Math.max(md.defaultFare, Math.round(c.d * ROUTE_FACTOR / 1000 * 25));
      const rick = { mode: "rickshaw", line: md.label, color: md.color,
                     min: rickMin, fare, minApprox: true, fareApprox: true,
                     key: "rickshaw|" + md.label };
      NET.adj[id].push({ to: c.id, ...rick });
      NET.adj[c.id].push({ to: id, ...rick });
    }
    links.push({ id: c.id, min: walkMin, walkMin, rickMin, distM: Math.round(c.d) });
  }
  return { ok: true, links };
}

function setLocationNode(NET, lat, lon, opts = {}) {
  return setPlaceNode(NET, LOC_ID, "My location", lat, lon, opts);
}
```

### E4 — exports
**FIND**
```js
  module.exports = { validateNetwork, buildNetwork, plan, planAll,
                     haversineMeters, setLocationNode, clearLocationNode, LOC_ID };
```
**REPLACE**
```js
  module.exports = { validateNetwork, buildNetwork, plan, planAll, haversineMeters,
                     setPlaceNode, clearPlaceNode, setLocationNode, clearLocationNode, LOC_ID };
```

---

## index.html

### H1 — place ids, HTML escaper, geocoder, link summary (after the state vars)
**FIND**
```js
let currentRoutes = [];
let selectedIdx = 0;
```
**REPLACE**
```js
let currentRoutes = [];
let selectedIdx = 0;

// ---- typed places (map search) -----------------------------------------
const PLACE_IDS = { from: "_place_from", to: "_place_to" };
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

function linkSummary(links) {
  return links.map(l =>
    `${NET.stops[l.id].name} (~${l.walkMin != null ? l.walkMin : l.min} min walk` +
    (l.rickMin ? ` / ~${l.rickMin} min rickshaw` : "") + ")"
  ).join(", ");
}
```

### H2 — `showSuggestions`: append the "Search the map" row
**FIND**
```js
    if (count === 0 && q !== "") {
       html = `<div class="sugg-item"><span class="sugg-ward" style="text-transform:none;">No stops found</span></div>`;
    }
    list.innerHTML = html;
    list.hidden = false;
```
**REPLACE**
```js
    if (count === 0 && q !== "") {
       html = `<div class="sugg-item"><span class="sugg-ward" style="text-transform:none;">No stops found</span></div>`;
    }
    if (q.trim().length >= 3) {
      html += `<div class="sugg-item sugg-geo" data-geo="1">
                 <span class="sugg-name">&#128269; Search the map for \u201c${esc(input.value)}\u201d</span>
                 <span class="sugg-ward" style="text-transform:none;">addresses, landmarks, anywhere in Kolkata</span>
               </div>`;
    }
    list.innerHTML = html;
    list.hidden = false;
```

### H3 — suggestion-tap handler: run searches, pick geocoded places
**FIND**
```js
  list.addEventListener("mousedown", (e) => {
    const item = e.target.closest(".sugg-item");
    if (!item || !item.dataset.id) return;
    const myLocId = typeof LOC_ID !== 'undefined' ? LOC_ID : "_loc";
    const id = item.dataset.id;
    hidden.value = id;

    if (id === myLocId) {
      input.value = "📍 Locating...";
      handleLocationPick(hiddenId, input);
    } else {
      input.value = NET.stops[id].name;
      prevSel[hiddenId] = id;
      render();
    }
    list.hidden = true;
  });
```
**REPLACE**
```js
  list.addEventListener("mousedown", async (e) => {
    const item = e.target.closest(".sugg-item");
    if (!item) return;
    const myLocId = typeof LOC_ID !== 'undefined' ? LOC_ID : "_loc";

    if (item.dataset.geo) {                     // "Search the map" row
      e.preventDefault();                       // keep focus so the list stays open
      if (geoBusy) return;
      geoBusy = true;
      const q = input.value.trim();
      list.innerHTML = `<div class="sugg-item"><span class="sugg-ward" style="text-transform:none;">Searching the map\u2026</span></div>`;
      try {
        const places = await geocode(q);
        list.innerHTML = places.length ? places.map(p =>
          `<div class="sugg-item" data-place="1" data-lat="${p.lat}" data-lon="${p.lon}" data-name="${esc(p.name)}">
             <span class="sugg-name">&#128205; ${esc(p.name)}</span>
             <span class="sugg-ward" style="text-transform:none;">${esc(p.detail)}</span>
           </div>`).join("") +
          `<div class="sugg-item sugg-attrib">search \u00a9 OpenStreetMap contributors</div>`
        : `<div class="sugg-item"><span class="sugg-ward" style="text-transform:none;">Nothing found for \u201c${esc(q)}\u201d around Kolkata \u2014 try a landmark or add the area name.</span></div>`;
      } catch (err) {
        list.innerHTML = `<div class="sugg-item"><span class="sugg-ward" style="text-transform:none;">Map search didn't respond \u2014 check your connection and try again.</span></div>`;
      }
      geoBusy = false;
      list.hidden = false;
      return;
    }

    if (item.dataset.place) {                   // a geocoded map result
      const pid = PLACE_IDS[hiddenId];
      const res = setPlaceNode(NET, pid, item.dataset.name,
                               parseFloat(item.dataset.lat), parseFloat(item.dataset.lon), {});
      list.hidden = true;
      if (!res.ok) { setLocStatus("Can't route there: " + res.reason); return; }
      hidden.value = pid;
      input.value = item.dataset.name;
      prevSel[hiddenId] = pid;
      setLocStatus(`\u201c${item.dataset.name}\u201d linked to: ` + linkSummary(res.links));
      render();
      return;
    }

    if (!item.dataset.id) return;               // plain rows: messages, attribution
    const id = item.dataset.id;
    hidden.value = id;

    if (id === myLocId) {
      input.value = "📍 Locating...";
      handleLocationPick(hiddenId, input);
    } else {
      input.value = NET.stops[id].name;
      prevSel[hiddenId] = id;
      render();
    }
    list.hidden = true;
  });
```

### H4 — Enter key triggers the map search
**FIND**
```js
  input.addEventListener("input", (e) => showSuggestions(e.target.value));
  input.addEventListener("focus", () => { input.select(); showSuggestions(input.value); });
```
**REPLACE**
```js
  input.addEventListener("input", (e) => showSuggestions(e.target.value));
  input.addEventListener("focus", () => { input.select(); showSuggestions(input.value); });
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const geoRow = list.querySelector("[data-geo]");
    if (geoRow && !list.hidden) geoRow.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  });
```

### H5 — GPS status line reuses the summary (now shows the rickshaw option too)
**FIND**
```js
    setLocStatus("Linked to nearest stops: " +
      res.links.map(l => `${NET.stops[l.id].name} (~${l.min} min walk)`).join(", "));
```
**REPLACE**
```js
    setLocStatus("Linked to nearest stops: " + linkSummary(res.links));
```

### H6 — `render()`: clear typed places once neither field points at them
**FIND**
```js
  if (from !== myLocId && to !== myLocId && NET.stops[myLocId]) {
    clearLocationNode(NET);
    setLocStatus("");
  }
```
**REPLACE**
```js
  let stale = false;
  if (from !== myLocId && to !== myLocId && NET.stops[myLocId]) { clearLocationNode(NET); stale = true; }
  for (const side in PLACE_IDS) {
    const pid = PLACE_IDS[side];
    if (from !== pid && to !== pid && NET.stops[pid]) { clearPlaceNode(NET, pid); stale = true; }
  }
  if (stale) setLocStatus("");
```

### H7 — CSS for the search row + attribution line (inside the `<style>` block)
**FIND**
```css
.sugg-ward { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
```
**REPLACE**
```css
.sugg-ward { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
.sugg-geo { border-top: 1px dashed var(--hair); }
.sugg-attrib { font-size: 10px; color: var(--muted); cursor: default; text-align: right; padding: 6px 12px; }
```

---

## sw.js

### S1 — never cache cross-origin calls in the app shell

**FIND**
```js
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
```
**REPLACE**
```js
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;   // map search etc: browser handles it, never cached
```

### S2 — cache bump

**FIND**
```js
const CACHE = "sanjog-v4";
```
**REPLACE**
```js
const CACHE = "sanjog-v5";
```
(If you haven't pushed the theme patch yet your file still says `v3` — just make it one
higher than whatever is there. Any change to `index.html`/`engine.js` needs a bump or
installed users, including the Play Store TWA, keep the old cached shell.)

---

## Verified

- All 12 FINDs occur exactly once in both pre-theme and themed files.
- 23/23 functional tests pass against your real 1,227-stop network: injection, dual
  walk+rickshaw links under 1.2 km / walk-only above, reverse edges, fare/time sanity,
  routing from a typed place (cheapest keeps the free walk), **place → place** routing
  (walk → metro → bus → auto → walk), cleanup, far-place refusal, GPS wrapper
  backward-compat, and geocode payload parsing against a fixture.
- At a ~570 m gap the planner picks rickshaw for Fastest (6 min + 1 wait vs 10 min walk)
  and walk for Cheapest — the intended tradeoff.
- All patched JS parses clean (`node --check`).

**Not verifiable from this sandbox:** the live Nominatim call itself (domain not reachable
here). First thing to check on your GitHub Pages deploy: type "Peter Cat", tap Search the
map, confirm results appear. Offline, map search fails with a friendly message while stop
search keeps working.
