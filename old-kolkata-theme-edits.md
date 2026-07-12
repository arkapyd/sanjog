# SANJOG — Old Kolkata theme

Seven find/replace edits across three files: `index.html` (5), `manifest.webmanifest` (1), `sw.js` (1).
Every FIND below was verified to occur **exactly once** in your current files, so order doesn't matter.
No new files — the sketches are inline SVG, so `sw.js`'s cache list and offline mode need no changes.

---

## Edit 1 — `index.html` · status-bar colour while running

**FIND**
```html
<meta name="theme-color" content="#0b0f16">
```
**REPLACE**
```html
<meta name="theme-color" content="#231a10">
```

---

## Edit 2 — `index.html` · the whole stylesheet

Select **everything between `<style>` and `</style>`** (currently `:root{` down to the
`@media (prefers-reduced-motion:reduce)` line) and replace it with:

```css
:root{
  --ink:#2b2014; --header:#231a10;
  --maroon:#7c3327; --maroon-deep:#5f2419;
  --accent:#e6a817; --accent-deep:#c9900d;
  --paper:#f3ead7; --surface:#fbf6ea; --muted:#7a6a52;
  --hair:rgba(72,54,30,.2); --map-bg:#241b11;
  --sans:"Helvetica Neue",Helvetica,Arial,"Segoe UI",Roboto,sans-serif;
  --serif:Georgia,"Iowan Old Style","Palatino Linotype","Times New Roman",serif;
}
*{box-sizing:border-box;margin:0}
body{color:var(--ink);font-family:var(--sans);line-height:1.45;
  background:
    radial-gradient(900px 460px at 88% -6%,rgba(150,105,40,.10),transparent 62%),
    radial-gradient(760px 420px at -8% 34%,rgba(130,90,35,.08),transparent 60%),
    radial-gradient(680px 380px at 52% 108%,rgba(120,80,30,.10),transparent 60%),
    var(--paper);
  background-attachment:fixed}
.wrap{max-width:680px;margin:0 auto;padding:0 16px 150px;position:relative;z-index:1}
.microlabel{font-size:11px;font-weight:700;letter-spacing:.14em;
  text-transform:uppercase;color:var(--muted)}

/* background sketches — old Kolkata riverside */
.bg-art{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
.bg-art svg{position:absolute;fill:none;stroke:rgba(74,54,28,.13);stroke-width:2;
  stroke-linecap:round;stroke-linejoin:round}
.bg-art path,.bg-art circle{vector-effect:non-scaling-stroke}
.bg-art .fill{fill:rgba(230,168,23,.33);stroke:none}
.art-bridge{left:50%;transform:translateX(-50%);bottom:0;width:min(1200px,160vw)}
.art-victoria{right:2%;bottom:118px;width:min(280px,52vw)}
.art-tram{left:-16px;bottom:18px;width:min(290px,58vw);stroke:rgba(74,54,28,.19)}
.art-taxi{left:44%;bottom:12px;width:min(230px,44vw);stroke:rgba(74,54,28,.19)}
@media (max-height:520px){.bg-art{display:none}}

/* map app autocomplete styles */
.autocomplete { position: relative; }
.autocomplete input {
  width: 100%; padding: 11px 10px; font: inherit; border: 1px solid var(--hair);
  border-radius: 7px; background: var(--surface); color: var(--ink);
}
.autocomplete input:focus {
  outline: 2px solid var(--maroon); border-color: var(--maroon);
}
.sugg-list {
  position: absolute; top: 100%; left: 0; right: 0; background: var(--surface);
  border: 1px solid var(--maroon); border-radius: 7px; margin-top: 4px;
  max-height: 240px; overflow-y: auto; z-index: 100;
  box-shadow: 0 8px 24px rgba(43,32,20,0.18);
}
.sugg-item {
  padding: 10px 12px; cursor: pointer; border-bottom: 1px solid var(--paper);
  display: flex; flex-direction: column; gap: 2px;
}
.sugg-item:last-child { border-bottom: none; }
.sugg-item:hover { background: var(--paper); }
.sugg-name { font-size: 13px; font-weight: 600; color: var(--ink); }
.sugg-ward { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }

/* kolkata taxi hint styling */
.taxi-hint {
  font-size: 11.5px; font-weight: 600; color: #6f5106; background: #f6e0a6;
  border: 1px solid #d9b13c; border-radius: 6px; padding: 5px 10px;
  margin: 4px 0 6px 29px; display: inline-block;
}

/* masthead */
header{background:var(--header);color:#f6efdf;border-bottom:4px solid var(--accent);
  position:relative;z-index:1}
.mast{max-width:680px;margin:0 auto;padding:30px 16px 20px}
.mast h1{font-family:var(--serif);font-size:clamp(34px,8vw,52px);font-weight:700;
  letter-spacing:.01em;line-height:1}
.mast h1 .bn{color:#cdbb96;font-weight:400;font-size:.55em;vertical-align:middle;margin-left:12px}
.tag{margin-top:9px;font-family:var(--serif);font-style:italic;font-size:16px;color:#cfc0a1}
.ticker{margin-top:14px;padding-top:12px;border-top:1px solid rgba(246,239,223,.18);
  font-size:12.5px;color:#9a8a6b;letter-spacing:.08em}

/* planner */
.panel{background:var(--surface);border:1px solid var(--hair);border-radius:10px;
  padding:16px;margin-top:-22px;box-shadow:0 8px 22px rgba(43,32,20,.12)}
.row{display:flex;gap:10px;align-items:end;flex-wrap:wrap}
.field{flex:1 1 180px}
label{display:block;font-size:11px;font-weight:700;letter-spacing:.12em;
  text-transform:uppercase;color:var(--muted);margin-bottom:6px}
select{width:100%;padding:11px 10px;font:inherit;border:1px solid var(--hair);
  border-radius:7px;background:var(--surface);color:var(--ink)}
#swap{flex:0 0 auto;height:44px;width:44px;border:1px solid var(--hair);
  border-radius:7px;background:var(--surface);color:var(--ink);cursor:pointer;
  display:flex;align-items:center;justify-content:center}
#swap:hover{border-color:var(--maroon);color:var(--maroon)}
#go{flex:1 1 100%;margin-top:2px;padding:13px;border:0;border-radius:7px;
  background:var(--accent);color:var(--ink);font-family:var(--sans);font-size:13px;
  font-weight:700;letter-spacing:.12em;text-transform:uppercase;cursor:pointer}
#go:hover{background:var(--accent-deep)}
.note{margin:14px 2px 0;font-size:12.5px;color:var(--muted)}
.warn{margin-top:14px;padding:11px 13px;border:1px solid var(--hair);
  border-left:3px solid var(--accent);border-radius:8px;background:var(--surface);
  font-size:13px;color:var(--ink)}

/* route cards */
#results{margin-top:20px;display:flex;flex-direction:column;gap:14px}
.card{background:var(--surface);border:1px solid var(--hair);border-radius:10px;
  padding:14px 16px;animation:rise .35s ease both;cursor:pointer}
.card.sel{border-color:var(--maroon);box-shadow:0 0 0 1px var(--maroon)}
@keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.chiprow{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:9px}
.chip{font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
  border:1px solid var(--hair);border-radius:99px;padding:3px 10px;color:var(--muted)}
.chip:first-child{background:var(--maroon);border-color:var(--maroon);color:#fbf6ea}
.totals{display:flex;align-items:baseline;gap:16px;font-variant-numeric:tabular-nums}
.stat{font-size:26px;font-weight:700;letter-spacing:-.01em}
.stat em{font-style:normal;font-size:13px;font-weight:400;color:var(--muted);margin-left:3px}
.chg{margin-left:auto;font-size:12.5px;color:var(--muted)}
.tl{display:flex;gap:2px;height:10px;margin:12px 0 12px}
.tl span{border-radius:2px;min-width:8px}
.legs{display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--hair);padding-top:12px}
.leg{display:flex;gap:9px;align-items:center;flex-wrap:wrap;font-size:14px}
.tile{width:20px;height:20px;border-radius:4px;color:#fff;flex:0 0 auto;
  display:inline-flex;align-items:center;justify-content:center;
  font-size:11px;font-weight:700}
.linename{font-weight:600;font-size:13px;white-space:nowrap}
.path{flex:1 1 auto;color:var(--muted)}
.nums{font-size:12.5px;color:var(--muted);white-space:nowrap;font-variant-numeric:tabular-nums}
.leg-sub{font-size:11.5px;color:var(--muted);margin:-4px 0 0 29px}
.approx{margin-top:10px;font-size:11.5px;color:var(--muted)}
.msg{padding:14px 4px;color:var(--muted)}

/* network map */
.maphead{display:flex;justify-content:space-between;align-items:baseline;
  gap:10px;margin:26px 0 10px}
.maphint{font-size:12px;color:var(--muted)}
.mapwrap{background:var(--map-bg);border:1px solid rgba(246,239,223,.1);
  border-radius:10px;padding:10px}
.mapwrap svg{display:block;width:100%;height:auto;font-family:var(--sans)}
.mapmsg{color:#b3a488;font-size:13px;padding:14px}

/* legend + footer */
.legend{margin-top:20px;display:flex;flex-wrap:wrap;gap:7px}
.lg{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:var(--muted);
  border:1px solid var(--hair);border-radius:99px;padding:4px 10px;background:var(--surface)}
.dot{width:10px;height:10px;border-radius:3px;display:inline-block}
footer{margin-top:28px;font-family:var(--serif);font-style:italic;font-size:12.5px;color:var(--muted)}

:focus-visible{outline:2px solid var(--maroon);outline-offset:2px}
@media (prefers-reduced-motion:reduce){.card{animation:none}}
```

What changed: aged-newsprint palette (sepia ink `--ink` on cream `--paper`), Georgia serif
masthead + italic tagline/footer, taxi-yellow `--accent` for the header rule / Find-routes
button / warning banner, heritage maroon `--maroon` replacing navy for focus rings, selected
cards and chips, warm-toned map panel, plus the `.bg-art` positioning rules for the sketches.
All your existing selectors (autocomplete, cards, taxi-hint, map, legend) are still here —
only colours, fonts and the new sketch rules differ.

---

## Edit 3 — `index.html` · the background sketches

**FIND**
```html
<body>
<header>
```
**REPLACE**
```html
<body>
<div class="bg-art" aria-hidden="true">
  <!-- Howrah Bridge -->
  <svg class="art-bridge" viewBox="0 0 520 180" preserveAspectRatio="xMidYMax meet">
    <path d="M0 138 H520 M0 146 H520"/>
    <path d="M135 138 L150 34 L165 138 M141 96 H159 M146 62 H154"/>
    <path d="M355 138 L370 34 L385 138 M361 96 H379 M366 62 H374"/>
    <path d="M30 138 Q95 58 150 36 M150 36 Q260 80 370 36 M370 36 Q425 58 490 138"/>
    <path d="M45 128 L75 96 L105 122 L135 62"/>
    <path d="M175 60 L205 108 L235 68 L265 108 L295 68 L325 108 L355 60"/>
    <path d="M385 62 L415 122 L445 96 L475 128"/>
    <path d="M210 90 V138 M260 82 V138 M310 90 V138"/>
    <path d="M0 164 q14 -7 28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0"/>
    <path d="M60 172 q14 -6 28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0"/>
  </svg>
  <!-- Victoria Memorial -->
  <svg class="art-victoria" viewBox="0 0 360 220">
    <path d="M10 200 H350"/>
    <path d="M40 200 V178 H320 V200 M52 189 H308"/>
    <path d="M80 178 V122 M280 178 V122 M74 122 H286 M96 122 V108 M264 122 V108 M96 108 H264"/>
    <path d="M148 108 V84 M212 108 V84 M144 84 H216"/>
    <path d="M144 84 Q180 22 216 84"/>
    <path d="M180 52 V34 L189 39 L180 44"/>
    <path d="M88 122 V104 M112 122 V104 M88 104 Q100 88 112 104 M100 95 V88"/>
    <path d="M248 122 V104 M272 122 V104 M248 104 Q260 88 272 104 M260 95 V88"/>
    <path d="M164 178 V150 Q180 134 196 150 V178"/>
    <path d="M112 178 V158 Q122 148 132 158 V178 M228 178 V158 Q238 148 248 158 V178"/>
  </svg>
  <!-- Tram -->
  <svg class="art-tram" viewBox="0 0 260 170">
    <path d="M0 16 H260"/>
    <path d="M148 46 L184 18"/>
    <circle cx="184" cy="18" r="2.5"/>
    <path d="M48 140 V54 Q48 46 56 46 H184 Q192 46 192 54 V140 M40 140 H200 M48 58 H192"/>
    <path d="M60 66 h18 v26 h-18 Z M87 66 h18 v26 h-18 Z M114 66 h18 v26 h-18 Z M141 66 h18 v26 h-18 Z M168 66 h18 v26 h-18 Z"/>
    <path d="M48 104 H192 M48 112 H192"/>
    <circle cx="66" cy="124" r="6"/>
    <circle cx="82" cy="150" r="9"/><circle cx="82" cy="150" r="3"/>
    <circle cx="158" cy="150" r="9"/><circle cx="158" cy="150" r="3"/>
    <path d="M6 161 H254"/>
  </svg>
  <!-- Ambassador taxi -->
  <svg class="art-taxi" viewBox="0 0 260 120">
    <path class="fill" d="M18 92 Q14 72 36 66 L60 62 Q68 40 94 36 H150 Q178 40 186 62 L208 68 Q224 74 222 92 Z"/>
    <path d="M18 92 Q14 72 36 66 L60 62 Q68 40 94 36 H150 Q178 40 186 62 L208 68 Q224 74 222 92 Z"/>
    <path d="M70 60 Q76 44 96 42 H146 Q164 46 170 60 Z M122 44 V88 M128 68 h12"/>
    <path d="M116 24 h22 v10 h-22 Z M122 34 V38 M132 34 V38"/>
    <circle cx="60" cy="92" r="15"/><circle cx="60" cy="92" r="6"/>
    <circle cx="178" cy="92" r="15"/><circle cx="178" cy="92" r="6"/>
    <circle cx="27" cy="73" r="4"/>
    <path d="M8 97 h34 M202 97 h42"/>
    <path d="M0 112 H260"/>
  </svg>
</div>
<header>
```

A fixed, non-interactive layer behind the content: Howrah Bridge spanning the bottom of the
viewport with the Hooghly's water lines, Victoria Memorial on the skyline right, and a tram +
Ambassador taxi (the one splash of colour — a faint yellow wash) up front. Line weights stay
a consistent 2px at any size via `vector-effect: non-scaling-stroke`.

---

## Edit 4 — `index.html` · map dots match the warm map panel

In `renderMap` — this fixes the stop-dot outlines, which would otherwise keep a navy halo
against the new sepia map background.

**FIND**
```js
stroke="#0f1626"
```
**REPLACE**
```js
stroke="#241b11"
```

---

## Edit 5 — `index.html` · map label colours

Also in `renderMap`, a few lines below.

**FIND**
```js
"#dbe4f0" : "#7d8aa0"
```
**REPLACE**
```js
"#f2e8d5" : "#a6937a"
```

---

## Edit 6 — `manifest.webmanifest` · splash + status bar in the packaged app

**FIND**
```json
"background_color": "#0b0f16",
  "theme_color": "#0b0f16",
```
**REPLACE**
```json
"background_color": "#f3ead7",
  "theme_color": "#231a10",
```

`background_color` is the splash-screen colour in the Android TWA and the iOS shell — now
aged paper, with your dark icon sitting on it like an ink stamp. `theme_color` is the Android
status bar, matching the masthead so the app top looks seamless.

---

## Edit 7 — `sw.js` · force the new shell to installed users

**FIND**
```js
const CACHE = "sanjog-v3";
```
**REPLACE**
```js
const CACHE = "sanjog-v4";
```

Without this, anyone who already installed the PWA (including the Play Store app — the TWA
runs the same service worker) keeps the cached old-theme `index.html` indefinitely.

---

## Keeping it consistent through PWABuilder

1. **Push all three files, then load the site once** to confirm the theme, before packaging.
2. **Regenerate the package on pwabuilder.com.** Splash colour, status-bar colour and icons
   are baked into the `.aab` / iOS bundle *at generation time* from the manifest — an old
   package keeps the old navy splash forever. Upload the regenerated `.aab` as a new release.
3. **Live pages follow the meta tag + manifest**, so in-app browsing matches automatically;
   the cache bump (Edit 7) makes existing installs pick the new shell up on next launch.
4. **Icons are deliberately unchanged** — the dark ink tile reads as a woodblock stamp on the
   new paper splash, and the maskable safe-zone still passes. If you later want warm-tinted
   icons, that's a separate regeneration + manifest untouched.
5. **No external fonts or images were added** (Georgia is a system font), so offline mode and
   the Play package stay fully self-contained.
