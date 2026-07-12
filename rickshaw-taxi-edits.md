# SANJOG — rickshaws as short-hop taxis

Six edits: `engine.js` (4), `index.html` (1), `sw.js` (1). Every FIND verified to occur
exactly once in the current files; apply in any order.

**The problem** (your screenshot): for a ~2 km trip the planner assembled
rickshaw → bus → bus → rickshaw, 64 min, ₹130 — algorithmically optimal, humanly absurd.
Nobody juggles three vehicles for a hop one rickshaw covers.

**The fix**: whenever origin and destination are within **~3 km of street distance**
(straight-line × 1.3), `planAll` builds a synthetic door-to-door rickshaw candidate and
weighs it against transit for each preference. If it wins Fastest / Cheapest / Fewest
changes, it takes that card. If transit genuinely beats it everywhere (e.g. two adjacent
metro stations), the rickshaw still appears as its own **"Rickshaw direct"** card — visible,
never forced. This works for every endpoint type: stops, GPS, typed places.

**Fare model, from your numbers**: `max(₹25, ₹40 × street-km)` — 200 m → ₹25, 1.5 km → ₹60,
3 km → ₹120. Time at ~7.8 km/h plus the 1-min hail wait. Everything shows `~` (it comes
down to bargaining). The place gap-fill links now use the same rule and fare, so first-mile
rickshaws also reach 3 km of street instead of the old 1.2 km, at consistent prices — no
weird arbitrage between a direct ride and a chained one.

It's a plan-time candidate, not a graph edge — the network data stays untouched, nothing
persists between searches, and a direct rickshaw can never become an accidental "shortcut"
inside longer multi-leg routes. Since the ride isn't a mapped corridor, the schematic map
draws it as a **dashed line** between the two endpoints (any future virtual leg gets the
same treatment automatically).

All the dials sit at the top of `engine.js`: `RICKSHAW_MAX_M` (3000),
`RICKSHAW_MIN_FARE` (25), `RICKSHAW_PER_KM` (40), `RICK_M_PER_MIN` (130).

---

## engine.js

### R1 — constants, fare model, and the direct-rickshaw candidate builder

**FIND**
```js
const LOC_ID = "_myloc";
const WALK_M_PER_MIN = 75;    // ~4.5 km/h
const RICK_M_PER_MIN = 130;   // ~7.8 km/h — cycle-rickshaw pace
const RICKSHAW_MAX_M = 1200;  // offer a rickshaw for gaps below this
const ROUTE_FACTOR = 1.3;     // straight-line -> street distance fudge
```
**REPLACE**
```js
const LOC_ID = "_myloc";
const WALK_M_PER_MIN = 75;     // ~4.5 km/h
const RICK_M_PER_MIN = 130;    // ~7.8 km/h — cycle-rickshaw pace
const RICKSHAW_MAX_M = 3000;   // rickshaws act as short taxis: up to ~3 km of street
const RICKSHAW_MIN_FARE = 25;  // floor — what a ~200 m hop costs
const RICKSHAW_PER_KM = 40;    // Rs per km of street distance -> ~Rs120 for a 3 km ride
const ROUTE_FACTOR = 1.3;      // straight-line -> street distance fudge

function rickshawFare(streetM) {
  return Math.max(RICKSHAW_MIN_FARE, Math.round(streetM / 1000 * RICKSHAW_PER_KM));
}

// A rickshaw hailed door to door — Kolkata's short-hop taxi. Returns a
// route-shaped candidate for planAll to weigh against transit, or null
// when the ride would exceed RICKSHAW_MAX_M of street distance.
function directRickshaw(NET, src, dst) {
  const md = NET.modes.rickshaw, a = NET.stops[src], b = NET.stops[dst];
  if (!md || !a || !b) return null;
  if (typeof a.lat !== "number" || typeof a.lon !== "number" ||
      typeof b.lat !== "number" || typeof b.lon !== "number") return null;
  const streetM = haversineMeters(a.lat, a.lon, b.lat, b.lon) * ROUTE_FACTOR;
  if (streetM > RICKSHAW_MAX_M) return null;
  const min = Math.max(2, Math.round(streetM / RICK_M_PER_MIN));
  const fare = rickshawFare(streetM);
  const leg = { key: "rickshaw|" + md.label, mode: "rickshaw", line: md.label,
                color: md.color, from: src, to: dst, min, fare,
                minApprox: true, fareApprox: true, wait: md.wait };
  return {
    legs: [leg],
    path: [{ from: src, to: dst, mode: "rickshaw", line: md.label, color: md.color,
             min, fare, minApprox: true, fareApprox: true, key: leg.key }],
    totalMin: min + md.wait, totalFare: fare, boardings: 1,
    approxMin: true, approxFare: true,
    sig: leg.key + ">" + dst
  };
}

// Is candidate a better answer than b for this preference?
function betterFor(pref, a, b) {
  if (pref === "cheapest") return a.totalFare < b.totalFare ||
                                  (a.totalFare === b.totalFare && a.totalMin < b.totalMin);
  if (pref === "easiest")  return a.boardings < b.boardings ||
                                  (a.boardings === b.boardings && a.totalMin < b.totalMin);
  return a.totalMin < b.totalMin;
}
```

### R2 — `planAll` weighs the direct rickshaw per preference; beaten-everywhere still shows

**FIND**
```js
function planAll(NET, src, dst) {
  const prefs = [["fastest", "Fastest"], ["cheapest", "Cheapest"], ["easiest", "Fewest changes"]];
  const out = [];
  for (const [pref, label] of prefs) {
    const r = plan(NET, src, dst, pref);
    if (!r) continue;
    const dup = out.find(o => o.sig === r.sig);
    if (dup) dup.labels.push(label);
    else out.push({ ...r, labels: [label] });
  }
  return out;
}
```
**REPLACE**
```js
function planAll(NET, src, dst) {
  const prefs = [["fastest", "Fastest"], ["cheapest", "Cheapest"], ["easiest", "Fewest changes"]];
  const direct = directRickshaw(NET, src, dst);
  const out = [];
  for (const [pref, label] of prefs) {
    let r = plan(NET, src, dst, pref);
    if (direct && (!r || betterFor(pref, direct, r))) r = direct;
    if (!r) continue;
    const dup = out.find(o => o.sig === r.sig);
    if (dup) dup.labels.push(label);
    else out.push({ ...r, labels: [label] });
  }
  // within range but beaten on every preference: still worth suggesting —
  // nobody juggles three vehicles for a hop a rickshaw covers in one.
  if (direct && !out.some(o => o.sig === direct.sig))
    out.push({ ...direct, labels: ["Rickshaw direct"] });
  return out;
}
```

### R3 — gap-fill links share the street-distance rule and fare model

**FIND**
```js
    // short hop: also offer a rickshaw for the same gap, planner picks
    let rickMin = null;
    if (NET.modes.rickshaw && c.d <= rickshawMaxM) {
      const md = NET.modes.rickshaw;
      rickMin = Math.max(2, Math.round(c.d * ROUTE_FACTOR / RICK_M_PER_MIN));
      const fare = Math.max(md.defaultFare, Math.round(c.d * ROUTE_FACTOR / 1000 * 25));
```
**REPLACE**
```js
    // short hop: also offer a rickshaw for the same gap, planner picks
    let rickMin = null;
    const streetM = c.d * ROUTE_FACTOR;
    if (NET.modes.rickshaw && streetM <= rickshawMaxM) {
      const md = NET.modes.rickshaw;
      rickMin = Math.max(2, Math.round(streetM / RICK_M_PER_MIN));
      const fare = rickshawFare(streetM);
```

### R4 — exports

**FIND**
```js
  module.exports = { validateNetwork, buildNetwork, plan, planAll, haversineMeters,
                     setPlaceNode, clearPlaceNode, setLocationNode, clearLocationNode, LOC_ID };
```
**REPLACE**
```js
  module.exports = { validateNetwork, buildNetwork, plan, planAll, haversineMeters,
                     directRickshaw, rickshawFare,
                     setPlaceNode, clearPlaceNode, setLocationNode, clearLocationNode, LOC_ID };
```

---

## index.html

### R5 — the map draws journey-only legs dashed

**FIND**
```js
  let dots = "", labels = "";
```
**REPLACE**
```js
  // legs that exist only for this journey (e.g. a direct rickshaw) have no
  // drawn network edge — show them dashed so the route is visible end to end
  if (route) for (const e of route.path) {
    const pk = e.from < e.to ? e.from + "~" + e.to : e.to + "~" + e.from;
    const drawn = (groups[pk] || []).some(g => g.key === e.key);
    if (!drawn && hasXY(e.from) && hasXY(e.to)) {
      const [x1, y1] = pt(e.from), [x2, y2] = pt(e.to);
      hot += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"` +
             ` stroke="${e.color}" stroke-width="5" stroke-linecap="round" stroke-dasharray="7 6"/>`;
    }
  }

  let dots = "", labels = "";
```

---

## sw.js

### R6 — cache bump

**FIND**
```js
const CACHE = "sanjog-v6";
```
**REPLACE**
```js
const CACHE = "sanjog-v7";
```

(Same rule as always: one higher than whatever your deployed file says, or installed
users — including the Play Store TWA — keep the old cached shell.)

---

## Verified — 22/22 against your real network

- Fare anchors: 200 m → ₹25, 1.5 km → ₹60, 3 km → ₹120, floor holds at 50 m.
- Range boundary honoured on both sides of 3 km street; a 7.5 km pair refused.
- **Darga Rd → Christopher Rd** (1.23 km straight): one rickshaw card, 13 min ~₹64,
  takes Fastest, Cheapest and Fewest changes.
- **Shyambazar → Shobhabazar** (425 m, metro-linked): metro keeps all three preference
  crowns (4 min ₹10), "Rickshaw direct" card still appears (5 min ₹25).
- **Your screenshot repro** ("Don Bosco" typed → Christopher Rd):
  before = 53–64 min / ₹70–115 / 3–4 boardings across rickshaw-train-bus chains;
  after = one rickshaw, **13 min ~₹61, 1 boarding**, beating the old fastest outright.
- Far pairs (Airport → Esplanade) produce byte-identical results to the old engine.
- Gap-fill: a point 2.1 km from its nearest stop now gets a rickshaw link (old engine:
  walk only) priced by the new model.
- All patched JS parses (`node --check`).
