# SANJOG — why "christopher road government" found nothing, and the fixes

## The three-layer answer to your question

**Layer 1 — you weren't actually searching Google.** The attribution row in your screenshot
says *Search © OpenStreetMap*: both Google layers (live Autocomplete *and* the Text Search
fallback) errored silently — the same key problem as the map — and only Nominatim ran.
Press **F12 → Network tab → the red `places:autocomplete` request → Response**: the body
names the exact reason in plain English (referrer blocked / API not allowed on key /
verification). Fix that once and this search works.

**Layer 2 — Nominatim is a geocoder, not a search engine.** It wants near-exact names.
The school is likely mapped as "…**Govt Sponsd** H.S School…", so your "government" token
matches nothing; OSM does no fuzzy matching. Google handles exactly this kind of query —
once the key lets it.

**Layer 3 — the local stop search was too literal.** Your network *has* a Christopher Rd
stop, but the dropdown matched the *whole* query string, and "christopher road government"
isn't a substring of "Christopher Rd". Fixed below.

## The edits — `index.html` (5), `sw.js` (1)

### F1 — tokenised, ranked local search

The local matcher now splits your query into words (≥3 letters), scores every stop by how
many words hit, and ranks by score, then prefix, then name — so "christopher road
government" surfaces **Christopher Rd** at the top, highlighted on the matched word.
Short queries keep the old plain-substring behaviour.

**FIND** — the whole `// 1. INSTANT LOCAL SEARCH` block, from that comment line down to its
closing `}` two lines above `if (localCount === 0 && q !== "") {` (it's the block containing
`const matchIdx = nameLower.indexOf(q);` and ending `if (localCount > 8) break;`).

**REPLACE**
```js
    // 1. INSTANT LOCAL SEARCH — tokenised: "christopher road government" still
    // surfaces the Christopher Rd stop, ranked by how many words hit
    if (q !== "") {
      const tokens = q.split(/\s+/).filter(w => w.length >= 3);
      const scored = [];
      for (const id in NET.stops) {
        if (id === myLocId) continue;
        const nameLower = NET.stops[id].name.toLowerCase();
        let score = 0;
        if (tokens.length) {
          for (const w of tokens) if (nameLower.includes(w)) score++;
        } else if (nameLower.includes(q)) score = 1;   // short queries: plain substring
        if (score > 0) scored.push({ id, score,
          starts: nameLower.startsWith(tokens[0] || q) ? 1 : 0 });
      }
      scored.sort((a, b) => b.score - a.score || b.starts - a.starts ||
        NET.stops[a.id].name.localeCompare(NET.stops[b.id].name));

      for (const hit of scored.slice(0, 9)) {
        const stop = NET.stops[hit.id];
        const nameLower = stop.name.toLowerCase();
        const first = (tokens.find(w => nameLower.includes(w)) || q);
        const matchIdx = nameLower.indexOf(first);
        const highlightedName = matchIdx === -1 ? esc(stop.name) :
          `${esc(stop.name.substring(0, matchIdx))}<b>${esc(stop.name.substring(matchIdx, matchIdx + first.length))}</b>${esc(stop.name.substring(matchIdx + first.length))}`;
        const locality = stop.ward && stop.ward !== "Kolkata" ? stop.ward : "";
        const localityHtml = locality ? `<span style="font-weight:400; color:var(--muted); font-size:12px; margin-left:6px;">· ${locality}</span>` : "";

        html += `<div class="sugg-item" data-id="${hit.id}">
                   <span class="sugg-name">${highlightedName}${localityHtml}</span>
                 </div>`;
        localCount++;
      }
    }
```

### F2a — a retry timestamp replaces the permanent kill-switch

**FIND**
```js
let gAutoOK = true;   // flips off after the first live-autocomplete failure
```
**REPLACE**
```js
let gAutoRetryAt = 0;   // after a live-autocomplete failure, retry from this time
```

### F2b — attempt live suggestions unless cooling down

**FIND**
```js
          let gHtml = "";
          if (gAutoOK) {
```
**REPLACE**
```js
          let gHtml = "";
          let liveOK = false;
          if (Date.now() >= gAutoRetryAt) {
```

### F2c — fall back for this attempt only, retry after 60s

**FIND**
```js
              gHtml += `<div class="sugg-item sugg-attrib">Powered by Google</div>`;
            } catch (err) {
              console.warn("Live suggestions unavailable, using one-shot map search:", err);
              gAutoOK = false;
            }
          }
          if (!gAutoOK) {
```
**REPLACE**
```js
              gHtml += `<div class="sugg-item sugg-attrib">Powered by Google</div>`;
              liveOK = true;
            } catch (err) {
              console.warn("Live suggestions unavailable, using one-shot map search (retrying in 60s):", err);
              gAutoRetryAt = Date.now() + 60000;
            }
          }
          if (!liveOK) {
```

Once you fix the key in Cloud Console, live Google search now revives within a minute —
no reload needed.

### F3 — the degraded mode says so

**FIND**
```js
            } else {
              gHtml += `<div class="sugg-item sugg-attrib">Nothing found for "${esc(q)}"</div>`;
            }
            gHtml += `<div class="sugg-item sugg-attrib">${lastGeoSource === "google" ? "Powered by Google" : "Search © OpenStreetMap"}</div>`;
```
**REPLACE**
```js
            } else {
              gHtml += lastGeoSource === "osm"
                ? `<div class="sugg-item sugg-attrib">Nothing found for "${esc(q)}" — Google search is unavailable right now (see the map panel), and the OpenStreetMap fallback needs near-exact names. Try the official name or a nearby landmark.</div>`
                : `<div class="sugg-item sugg-attrib">Nothing found for "${esc(q)}"</div>`;
            }
            gHtml += `<div class="sugg-item sugg-attrib">${lastGeoSource === "google" ? "Powered by Google" : "Limited search © OpenStreetMap"}</div>`;
```

## sw.js

### S1 — cache bump

**FIND**
```js
const CACHE = "sanjog-v11";
```
**REPLACE**
```js
const CACHE = "sanjog-v12";
```

## Verified — 62/62

The full suite plus six new tests: your literal query "christopher road government"
surfaces the Christopher Rd stop **ranked first**; with every Google endpoint stubbed dead,
the dropdown shows the honest degraded message and "Limited search © OpenStreetMap"; no
live retry fires inside the 60-second window; and the retry fires after it. Live-key
behaviour still needs the console fix — F12's Network tab names the exact reason.
