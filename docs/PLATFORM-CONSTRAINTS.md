# Platform constraints

What the delivery model actually permits. Every number here was measured in this
repo or in a browser, not estimated. Where something is unverified it says so.

Re-measure before trusting anything here after a browser generation passes.

---

## The model we are building for

A customer visits a website, buys a game, downloads it, and plays it offline.

That is not the same target as a hosted web game, and the difference is not
cosmetic. A downloaded game is opened from the local filesystem, so it runs on
the `file:` protocol, and `file:` is a materially weaker environment than
`http:`. The constraints below all follow from that one fact.

---

## The reference bar

`moon-rover` (REGOLITH) is the quality bar. Measured from the submodule:

| | |
|--:|:--|
| **379 KB** | gzipped download (1.61 MB raw) |
| **266 KB** | of that is the vendored three.js — **70% of the whole download** |
| **113 KB** | the game itself: all code, all art, all audio, all content |
| **7,309** | lines in `src/` |
| **0** | npm dependencies, build steps, asset files |

The lesson is in the third row. Every texture, sound, rock and star is generated
by code at load, which is why a 3D game fits in less space than a single
uncompressed screenshot. **Assets are code.**

---

## What `file:` takes away

Probed in Chrome, default flags, no `--allow-file-access-from-files` (customers
will not have it either).

| capability | on `file:` | consequence |
|---|---|---|
| Inline `<script>` | works | this is the one to use |
| External `<script src>` | works | classic scripts load fine |
| **External ES module `import`** | **BLOCKED** | see below |
| **Import maps** | **BLOCKED** | same failure |
| `fetch()` of a sibling file | **BLOCKED** | no external JSON, levels or data |
| **IndexedDB** | **BLOCKED** | saves cannot use it |
| `localStorage` | works, and persists across restarts | this is the only save store |
| Canvas 2D, `getImageData`, `toDataURL` | works | procedural texture work is fine |
| WebAudio | works, starts `suspended` | needs a user gesture first |
| WebGL2 | works | a 2.5D or 3D game is still possible later |

### The module problem

This is the single most important finding, because it invalidates the reference
project's architecture for our use case:

```
BLOCKED: TypeError: Failed to fetch dynamically imported module: file:///…/lib.js
```

Relative imports and bare specifiers behind an import map both fail. `moon-rover`
is built entirely from ES modules and says so in its own README — it requires
HTTP, not `file://`. That is fine for a game published to GitHub Pages, and fatal
for a game someone downloads and double-clicks.

Note that an *inline* `<script type="module">` does run. Only fetching a separate
module file is blocked, so the failure looks confusing at first: modules "work"
right up until you split the code into files.

**So: each game ships as one self-contained `.html` file with inline classic
scripts.** Author it as many files if that is more pleasant and concatenate on
release, but the artifact the customer gets is one file with no external
references. That also means no TypeScript and no bundler unless we add a build
step purely for release packaging.

### The shared-origin problem

Every page loaded from `file:` shares one origin — literally `file://`. There is
no per-file separation, so two games a customer has downloaded read and write the
same `localStorage`.

Demonstrated: a key written by `probe2.html` was visible to `othergame.html`,
and vice versa. The spike's own HUD reports the foreign keys it can see sitting
next to its own save.

**So: every storage key is prefixed with the game and a schema version**, e.g.
`sharky.v1.save`. This is not tidiness. It is the only thing standing between two
of our own games corrupting each other's saves. It also means a save can never
hold anything private — another downloaded game, ours or not, can read it.

---

## Size is not the binding constraint

Worth being honest about, because it changes what we should optimise for.

| | download | wait at 25 Mbps |
|---|--:|--:|
| The single-file spike in `spikes/` | 6.7 KB | 0.002 s |
| moon-rover, a full 3D game | 379 KB | 0.12 s |
| A hypothetical 5 MB asset-heavy game | 5 MB | 1.6 s |

A 5 MB download is already imperceptible, and a paying customer tolerates far
more than a casual web visitor. So "small enough to download quickly" is
satisfied almost automatically and should not be the reason we make decisions.

The real reasons to generate art from code are different and better:

- No asset pipeline, no licensing, and nothing to attribute.
- One parametric body plan yields an unlimited bestiary, which is what a
  solo-plus-agent workflow can actually sustain.
- Creatures stay correct at every size, which an eat-to-grow game needs
  continuously and a sprite sheet cannot give without many resolutions.

Keep the no-assets doctrine. Just stop justifying it with download size.

---

## What cannot be protected

The game ships as readable HTML and JavaScript, so a paid download can be opened,
read, copied and reshared. Minifying is a speed bump, not protection, and an
offline licence check is breakable by definition because the check runs on the
customer's machine with no server to appeal to.

There is no technical fix within this delivery model. Price and position
accordingly, the way indie storefronts already do. Do not spend effort on DRM
that cannot work.

---

## Scores now, leaderboards later

Offline high scores are the near-term goal, with a leaderboard later. Two
consequences worth handling now, while it is free:

**Nothing submitted from an offline client is trustworthy.** `localStorage` is
player-editable, so any score uploaded later is a claim, not a fact. A future
leaderboard either accepts that (and is a fun list rather than a ranking), or
validates server-side by replaying a recorded input log against a deterministic
simulation.

That second option is only available if we keep it open, and it is cheap to keep
open: make the simulation deterministic from a seed, and keep a fixed timestep
separate from rendering. `moon-rover` already demonstrates the pattern with its
seeded `core/rng.js` shared between CPU and GPU. If simulation is deterministic,
a replay is a seed plus an input list — kilobytes, and verifiable later.

**Give the save a schema version and stable ids from the first commit.**
`moon-rover`'s `ARCHITECTURE.md` documents exactly what happens otherwise: its
anomaly saves are a bare array of `0/1/2` codes re-keyed by array index, so any
change to world generation silently moves flags onto the wrong objects, and the
only reset lever is bumping a magic string. Do not repeat that. Write
`{ schema: 1, ... }` with named keys, and add an export/import save code so a
player can move or recover their progress.

---

## Per-game notes

### Sharky

Decided: 2D canvas, no library, parametric creatures. See
`spikes/single-file-canvas-probe.html` for a working proof of all of it.

The one place the reference project's approach does **not** transfer for free:
the Moon is noise, so fractal noise genuinely produces a lunar surface. Nothing
about noise produces a charismatic animal. Creature art has to come from
parametric shape construction instead — a body plan of roughly a dozen numbers
per species, animated by a travelling sine wave down the spine. The environment
(caustics, shafts, murk, particulate, kelp) is squarely back in noise territory
and is what will read as "good graphics".

Two things the spike already taught us:

- Eye radius must scale with the *square root* of body length. Scaling it
  linearly gave the 150 px shark a dinner-plate eye and made it read as a
  cartoon minnow.
- Do not evaluate a noise field per-pixel at full resolution; its sample grid
  shows up as hard squares. Render light at 160×90 and let `drawImage` upscale
  it, which buys a smooth falloff for free and costs 14k pixels a frame instead
  of a million.

### Yes-General

Has effectively no size or rendering problem: hexes, icons and text land well
under 150 KB with no library at all. Its difficulty is entirely design —
economy balance, era progression, and AI opponents worth playing against.

One warning inherited directly from the reference project. Its `ARCHITECTURE.md`
says of its own mission system:

> Fix this before writing story content, not after. Each mission added before
> the refactor makes the refactor more expensive.

Its objectives are nine hardcoded ids plus comparisons against `missionIdx` that
gate content by position in the campaign. A strategy game is that same trap at
ten times the scale, so Yes-General's rules and content must be data-driven from
the first commit rather than retrofitted.

---

## Verify it yourself

```bash
git submodule update --init --depth 1    # fetch the reference game
cd moon-rover && npm start               # then open http://localhost:5173
```

The spike needs no server at all, which is the whole point — open
`spikes/single-file-canvas-probe.html` directly in a browser.
