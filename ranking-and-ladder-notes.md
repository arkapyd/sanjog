# Shonjog — ranking fixed, Bhawanipur findable, your updates preserved

**Apply:** replace `index.html` with this one; `sw.js` goes to **v13**.

## Your updates, all kept

The rotated API key, OG/Twitter meta + `social-preview.png` (remember to upload that file
to the repo root), GoatCounter analytics, the **sign-in button and the whole Firebase
module** (Google auth + the `window.suggestStop` crowdsourced stop-verification writing to
Firestore `pending_stops` with 10 m dedup and the 10-vote threshold — untouched), emoji
sorter labels, the Shonjog rename including the `history.state` marker (you renamed both
the write and the read side — consistent, no regression), and your single-line formatting.

Three heads-ups only you can act on: (1) the **old key is burned** — it lives in this
chat and your repo history; delete it in Cloud Console now that the new one is in. (2) The
new key needs the same lock-down: website restriction `https://arkapyd.github.io/*`, API
restrictions = Places API (New) + Maps JavaScript API, and a daily quota cap. (3) The
Firebase web config being public is fine by design, but that means **Firestore security
rules** are the only thing stopping anonymous writes to `pending_stops` — make sure rules
require auth (and ideally rate-limit) before this ships wide.

## The fixes you asked for

**Best matches at the bottom — fixed with tiered ranking.** "south point school" splits
into three tokens; stops grazing one word (South**ern** Ave, Four**point** Crossing,
Police Training **School**) each scored 1-of-3 yet monopolised the top. Now: local stops
matching **most of the words** (or prefix-matching your query) stay above Google; one-word
grazes drop **below** the Google results, capped at three; the credit row stays last. So
the real South Point School lands right under any genuinely-strong local hits — and
"howrah maidan" still puts the Howrah Maidan stop first, above Google.

**Bhawanipur Education Society College — two-part answer.** Your attribution row still
says *Limited search © OpenStreetMap*, so you're on the Nominatim floor while the key
issue stands; Google finds the college trivially once live search works (and the 60 s
auto-retry revives it without a reload — which I also restored, see below). Meanwhile the
floor is raised: Nominatim now climbs a **retry ladder** — exact-name inside the Kolkata
box → box as bias only → query + ", Kolkata" — with 450 ms waits between rungs to respect
its 1-req/s policy. Near-miss names that OSM knows under fuller titles now get a third
chance instead of a shrug.

## One judgment call, flagged openly

Your upload had reverted the search internals to the per-pause Text Search draft — but it
kept `gAutoRetryAt`, `uuid()` and `googleAutocomplete()` as orphaned, uncalled code, which
reads like copy-drift while you were wiring Firebase rather than a deliberate rollback. So
I restored the **session-token Autocomplete** as the primary (all keystrokes ~$0 when the
pick closes the session via Place Details), with your Text Search → OSM flow as the
automatic fallback and the 60-second retry. Your loading row, anti-race guard, red error
row, 400 ms debounce and all wording survive — and local stop matches render instantly
again, with only the Google call debounced. If the revert *was* deliberate, say so and
I'll put your version back as primary in one edit.

## Verified — 69/69

The full suite on your file (deep links, pins under the renamed `Shonjog.*` keys, share,
sorters, sticky pill, dark mode, marker-clean reloads, offline) plus new: weak grazes
render below Google with the credit last; ≤3 grazes; "howrah maidan" strong-match stays on
top; the ladder's third rung finds "The Bhawanipur Education Society College" and the
result pins and routes; all three rungs climbed; degraded messaging and the 60 s cool-off
still behave with the ladder in the loop. The Firebase module is network-only so headless
tests skip it — first live checks: sign-in popup works, and once the key is fixed, type
"bhawanipur education society" and watch it appear under Powered by Google.
