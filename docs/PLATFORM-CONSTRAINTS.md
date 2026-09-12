# Platform constraints

What the delivery model permits, and what it forbids. Every number and every
capability below was measured in a browser, not estimated. Where something is
unverified it says so explicitly.

Re-measure before trusting this after a browser generation passes.

---

## The delivery model

**Each game is an installable PWA.** The customer buys it on the website, opens
it, and it installs to their home screen or desktop. A service worker precaches
the whole game so it runs with no network at all.

This was chosen over a file download because the games are mobile-shaped and a
downloaded `.html` is painful to open on a phone. The consequences of that choice
run through everything below, so it is worth understanding why it matters rather
than treating it as packaging.

### Verified: a PWA really does run with the server dead

Not assumed. The probe registered a service worker, precached its files, then the
server process was killed and the page reloaded:

```
$ curl -m 3 http://localhost:5199/
curl HTTP code: 000        (connection refused)
```

```json
{
  "moduleImport": "external ES module import worked",
  "swActive": true,
  "controlled": true,
  "storage": true,
  "indexedDB": true,
  "uncachedRequestToServer": "UNREACHABLE (TypeError: Failed to fetch)"
}
```

The last line is the one that makes the rest trustworthy: a request for a URL the
cache does not hold *fails*, which proves the server was genuinely down and
everything else came from the service worker.

### Two caveats that came out of that probe

**A game is only offline-capable from the second load onward.** On the first
visit `controlled` was `false` — a page that registers its worker during load is
not itself intercepted by it. So the install flow has to get the player to load
the game at least twice, or precache aggressively on first visit and tell them
when it is ready to go offline. Do not promise offline play on first paint.

**`navigator.onLine` is not an offline signal.** It reported `true` throughout the
test, because the network interface was up and only the server was dead. Never
branch on it. If you need to know whether something is reachable, try the request
and handle the failure.

---

## What the PWA choice buys back

Serving over HTTP (HTTPS in production; `localhost` also counts as a secure
context, which is why local development works) restores nearly everything a file
download would have cost us:

| capability | available |
|---|---|
| External ES modules, split across files | yes |
| Import maps | yes |
| `fetch()` of game data files | yes |
| IndexedDB | yes |
| `localStorage` | yes |
| Canvas 2D, WebAudio, WebGL2 | yes |

So we can keep `moon-rover`'s readable module layout — `src/core/`, `src/game/`,
`src/ui/`, plain ES modules, no build step. **This is the main practical reason
the PWA decision matters**: the alternative forced every game into a single
inlined HTML file with no module boundaries.

Service worker registration itself requires a secure context, so a PWA cannot be
tested from `file://` at all. Use the local dev server.

---

## What still bites

### `localStorage` is scoped to an ORIGIN, not to a path

This is the one hazard that survives the move to PWAs, and it is easy to get
wrong because it looks fixed.

Two games served from `example.com/sharky/` and `example.com/yes-general/` share
one `localStorage`. There is no path-level separation. The same is true, more
severely, on `file://`, where every page in the world shares the single origin
`file://` — demonstrated in the probe, where one local file read a save written
by a different local file:

```
"sawOtherGameKey": "SHARK_SAVE_FROM_A_DIFFERENT_FILE"
```

**Every storage key is prefixed with the game and a schema version**, e.g.
`sharky.v1.profile`. Not for tidiness — it is the only thing preventing two of
our own games from corrupting each other's saves. It also means a save can never
hold anything secret, since anything else on that origin can read it.

Giving each game its own subdomain would isolate them properly. Until that is
certain, assume a shared store.

### Storage can be evicted

Browsers may evict `localStorage` and IndexedDB under storage pressure, and
Safari is the most aggressive about it for sites the user has not installed. A
progression game that silently loses a profile is a refund request.

Mitigations, in order of cost: ship an export/import save code so a player can
recover or migrate by hand; prompt installation, since installed PWAs are treated
as more durable; and call
[`navigator.storage.persist()`](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist),
which *requests* exemption from eviction and may be refused. **Unverified here:**
actual iOS eviction behaviour and whether `persist()` is granted were not tested
on this VM and need checking on real devices.

### WebAudio starts suspended

An `AudioContext` begins in state `suspended` and needs a user gesture before it
will produce sound. `moon-rover` handles this by gating every public audio method
on a `ready` flag, because its menu clicks call into audio before the game has
started and any ungated path throws. Copy that pattern.

### Offline means content is frozen at install

There is no server call to change balance or push an event. Updating a game means
shipping a new service worker cache version and having clients pick it up, which
is a deliberate mechanism to build rather than something that happens for free.

---

## Size is not the binding constraint

Worth internalising, because it changes what to optimise.

| | download | wait at 25 Mbps |
|---|--:|--:|
| The single-file spike in `spikes/` | 6.7 KB | 0.002 s |
| `moon-rover`, a complete 3D game | 379 KB | 0.12 s |
| A hypothetical 5 MB asset-heavy game | 5 MB | 1.6 s |

A 5 MB download is already imperceptible, and a paying customer tolerates far
more than a casual visitor. "Small enough to download quickly" is satisfied
almost automatically and should not be the reason for any decision.

Generate art from code for the reasons that actually hold:

- No asset pipeline, nothing to license, nothing to attribute.
- One parametric body plan yields an unlimited bestiary, which is what a
  small team plus agents can sustain.
- Creatures stay correct at every size — which an eat-to-grow game needs
  continuously, and which a sprite sheet cannot provide without shipping many
  resolutions.

Keep the no-assets doctrine. Stop justifying it with download size.

For reference, measured runtime cost of the alternatives, minified and gzipped:
`kontra` 11 KB, `kaplay` 67 KB, `excalibur` 143 KB, `pixi.js` 225 KB, `phaser`
343 KB, `three.js` 250 KB, and no library at all 0 KB.

---

## What cannot be protected

The game ships as readable HTML and JavaScript. It can be opened, read, copied
and reshared, and an offline licence check runs on the customer's machine with no
server to appeal to. Minification is a speed bump, not protection.

There is no technical fix inside this delivery model. Price and position
accordingly, as indie storefronts already do, and do not spend effort on DRM that
cannot work.

---

## Appendix: why not a file download

Recorded so the question does not get reopened by accident. A downloaded `.html`
opened from disk runs on `file:`, where Chrome (default flags) blocks:

- **External ES module imports**, and import maps with them:
  ```
  BLOCKED: TypeError: Failed to fetch dynamically imported module: file:///…/lib.js
  ```
  Note that an *inline* `<script type="module">` does run, so the failure is
  confusing: modules appear to work right up until the code is split into files.
- **`fetch()` of a sibling file**, so no external level or data files.
- **IndexedDB**, entirely.
- **Service workers**, since `file:` is not a secure context.

`localStorage`, Canvas 2D, WebAudio and WebGL2 all do work there, so a
single-file game is genuinely possible — `spikes/single-file-canvas-probe.html`
is a working one, and it is worth opening to see the technique. But it forces
every game into one inlined file, and it does not solve mobile. Hence the PWA.
