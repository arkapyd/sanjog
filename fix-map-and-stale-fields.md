# SANJOG — map-key diagnostic + no more stale From/To

Six small edits: `index.html` (5), `sw.js` (1). All FINDs verified exactly-once.

## First, the map — 30 seconds of diagnosis before any settings

Your screenshot proves the API is **enabled on the project**. That is a different switch
from the **key's own API-restrictions allow-list** — a key restricted to "Places API (New)"
(as we set up earlier) is refused by Maps JS even though the API is enabled. Press **F12**
on the page: Google prints the exact error name in the console.

- `ApiTargetBlockedMapError` → Credentials → your key → API restrictions → **add "Maps
  JavaScript API"** to the allowed list. Prime suspect.
- `RefererNotAllowedMapError` → the key's website restriction doesn't cover the address
  you're testing from (e.g. localhost vs `arkapyd.github.io`).
- Billing/verification-flavoured errors → the "Account verification under review" banner
  from your screenshot; nothing to fix on the key, wait for Google's review to clear.

The app now shows **one** themed diagnostic saying exactly this (and wipes Google's grey
"Sorry! Something went wrong" panel so the two messages stop overlapping).

## Second, the stale From/To

Two culprits stacked: after every plan the app writes `?from=&to=` into the URL (that's
what makes Share links work), so reloading your own tab re-applied your last search; and
browsers also restore form values on reload regardless. Fix: plan-URLs now carry a history
**session marker** that survives reloads — params written by *your own tab* are treated as
leftovers (stripped; clean placeholders greet you), while a *pasted or shared* link has no
marker and still opens fully planned. Fields are also explicitly blanked at boot to defeat
the browser's form restore. Your last journey is still one tap away on its recents chip.

---

## index.html

### U1 — plan URLs carry a session marker

**FIND**
```js
    history.replaceState(null, "", u);
  } catch (e) { }
}

function applyURLParams() {
```
**REPLACE**
```js
    history.replaceState({ sanjog: 1 }, "", u);
  } catch (e) { }
}

function applyURLParams() {
```

### U2 — own leftovers boot clean; shared links still plan

**FIND**
```js
function applyURLParams() {
  try {
    const u = new URL(location.href);
    const f = parseEpParam(u.searchParams.get("from"));
    const t = parseEpParam(u.searchParams.get("to"));
    if (f && t) { applyEndpoint("from", f); applyEndpoint("to", t); return true; }
  } catch (e) { }
  return false;
}
```
**REPLACE**
```js
function applyURLParams() {
  try {
    const u = new URL(location.href);
    if (!u.searchParams.has("from") && !u.searchParams.has("to")) return false;
    // the marker survives reloads: params written by THIS tab's own planning are
    // leftovers, so boot clean with placeholders — a pasted/shared link has no
    // marker and still opens fully planned
    if (history.state && history.state.sanjog) {
      u.searchParams.delete("from"); u.searchParams.delete("to");
      history.replaceState(null, "", u);
      return false;
    }
    const f = parseEpParam(u.searchParams.get("from"));
    const t = parseEpParam(u.searchParams.get("to"));
    if (f && t) { applyEndpoint("from", f); applyEndpoint("to", t); return true; }
  } catch (e) { }
  return false;
}
```

### U3 — explicit blanking defeats the browser's form restore

**FIND**
```js
function initSearchFields() {
  // fields start empty and instructive — the placeholders do the talking
  setupAutocomplete("from-input", "from-list", "from");
  setupAutocomplete("to-input", "to-list", "to");
}
```
**REPLACE**
```js
function initSearchFields() {
  // fields start empty and instructive — the placeholders do the talking
  // (explicit blanking also defeats the browser's own form-state restore)
  for (const side of ["from", "to"]) {
    document.getElementById(side).value = "";
    document.getElementById(side + "-input").value = "";
  }
  setupAutocomplete("from-input", "from-list", "from");
  setupAutocomplete("to-input", "to-list", "to");
}
```

### M1 — one themed diagnostic on auth failure (no more double overlay)

**FIND**
```js
  window.gm_authFailure = () =>
    mapNote("Google Maps rejected the key — in Cloud Console, add \u201cMaps JavaScript API\u201d to this key's allowed APIs.");
```
**REPLACE**
```js
  window.gm_authFailure = () => {
    // Google injects its own grey error panel into the map div; clear it so the
    // themed note below is the only message on screen
    setTimeout(() => { const m = document.getElementById("map"); if (m) m.innerHTML = ""; }, 80);
    mapNote("Google Maps refused this key. Press F12 \u2014 the console names the exact error. " +
            "Usual suspects: the key's API restrictions are missing \u201cMaps JavaScript API\u201d " +
            "(enabling the API on the project is a separate switch from allowing it on the key); " +
            "the key's website restriction doesn't cover this address; or the account " +
            "verification Google is reviewing hasn't cleared yet.");
  };
```

### M2 — the longer note gets comfortable typography

**FIND**
```css
.mapmsg{color:#b3a488;font-size:13px;padding:14px;position:absolute;inset:6px;
  display:flex;align-items:center;justify-content:center;text-align:center;margin:0}
```
**REPLACE**
```css
.mapmsg{color:#b3a488;font-size:13px;line-height:1.55;padding:24px;position:absolute;inset:6px;
  display:flex;align-items:center;justify-content:center;text-align:center;margin:0}
.mapmsg::before{content:"";position:absolute;inset:0;background:var(--map-bg);z-index:-1;border-radius:12px}
```

---

## sw.js

### S1 — cache bump

**FIND**
```js
const CACHE = "sanjog-v10";
```
**REPLACE**
```js
const CACHE = "sanjog-v11";
```

---

## Verified — 56/56

The whole merged suite still passes, plus four new tests: reloading your own tab boots
clean with placeholders and strips the leftover params; a genuinely shared link (no
marker) still opens fully planned; and planning stamps the session marker. What headless
testing can't confirm is the live key itself — after fixing whatever F12 names, hard-reload
and the sepia map should paint.
