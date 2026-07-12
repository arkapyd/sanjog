# SANJOG — photo-sketch background

Replaces the hand-drawn SVG art layer with a pencil-sketch rendering of your Howrah Bridge
photo as the full-page background. **One new file + six edits**: `index.html` (4),
`sw.js` (2). Every FIND verified to occur exactly once.

**The image**: `bg-howrah-sketch.jpg` (1299×631, 82 KB) — upload it to the **repo root**,
same folder as `index.html`; the CSS references it relatively. It was produced from your
photo: red border artifacts cropped, dodge-blend pencil conversion (grayscale against its
blurred inverse), strokes deepened (gamma 1.6), then tinted so pure white maps to the
theme's paper `#f3ead7` and full black lands only ~half-way toward sepia ink. The faintness
is baked into the pixels, so the CSS needs no opacity tricks and text stays readable over
it. If you ever swap the photo, the same pipeline applies to any image — just ask.

One thing only you can confirm: the photo ships publicly in the repo and app, so make sure
it's yours or licensed for it — swapping in a replacement later is a two-minute job.

---

## New file

`bg-howrah-sketch.jpg` → repo root. (GitHub web UI: Add file → Upload files.)

---

## index.html

### B1 — remove the SVG art layer

Select from `<body>` down to `<header>` (the whole `bg-art` div sits between them) and
replace with just the two boundary lines.

**FIND**
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
**REPLACE**
```html
<body>
<header>
```

### B2 — the body background gains the sketch layer

**FIND**
```css
body{color:var(--ink);font-family:var(--sans);line-height:1.45;
  background:
    radial-gradient(900px 460px at 88% -6%,rgba(150,105,40,.10),transparent 62%),
    radial-gradient(760px 420px at -8% 34%,rgba(130,90,35,.08),transparent 60%),
    radial-gradient(680px 380px at 52% 108%,rgba(120,80,30,.10),transparent 60%),
    var(--paper);
  background-attachment:fixed}
```
**REPLACE**
```css
body{color:var(--ink);font-family:var(--sans);line-height:1.45;
  background:
    radial-gradient(900px 460px at 88% -6%,rgba(150,105,40,.10),transparent 62%),
    radial-gradient(760px 420px at -8% 34%,rgba(130,90,35,.08),transparent 60%),
    radial-gradient(680px 380px at 52% 108%,rgba(120,80,30,.10),transparent 60%),
    url("bg-howrah-sketch.jpg") center / cover no-repeat,
    var(--paper);
  background-attachment:fixed}
```

(The age-spot gradients stay layered over the sketch; `var(--paper)` remains the base so
the page looks right for the instant before the image loads — and forever if it's missing.)

### B3 — remove the art-layer CSS

Delete this whole block (replace with nothing):

**FIND**
```css

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
```

### B4 — bottom padding back to normal (the art strip is gone)

**FIND**
```css
.wrap{max-width:680px;margin:0 auto;padding:0 16px 150px;position:relative;z-index:1}
```
**REPLACE**
```css
.wrap{max-width:680px;margin:0 auto;padding:0 16px 56px;position:relative;z-index:1}
```

---

## sw.js

### B5 — the sketch joins the offline shell

**FIND**
```js
const SHELL = ["./", "./index.html", "./engine.js", "./network.json",
               "./manifest.webmanifest",
               "./icon-192.png", "./icon-512.png", "./icon-512-maskable.png"];
```
**REPLACE**
```js
const SHELL = ["./", "./index.html", "./engine.js", "./network.json",
               "./manifest.webmanifest", "./bg-howrah-sketch.jpg",
               "./icon-192.png", "./icon-512.png", "./icon-512-maskable.png"];
```

### B6 — cache bump

**FIND**
```js
const CACHE = "sanjog-v7";
```
**REPLACE**
```js
const CACHE = "sanjog-v8";
```
(One higher than whatever your deployed file says, as always.)

---

## Notes

- No manifest change, so **no PWABuilder regeneration needed** — the cache bump alone
  updates installed users, including the Play Store TWA.
- Darkness was tuned for readability: the sketch's mean luminance is ~218 against paper's
  ~231, with only tiny spots (birds, dense truss overlaps) reaching ~141 — opaque cards
  cover the busy middle anyway.
- iOS Safari ignores `background-attachment:fixed`, so there the sketch scrolls with the
  page instead of staying pinned. Harmless, just so you know it's not a bug.
- Verified: art layer and all `.bg-art`/`.art-*` references fully gone, inline JS and
  `sw.js` parse clean.
