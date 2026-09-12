# Sharky

> I want to make a hungry shark style game with side scrolling action where it
> is endless and a little silly. I like feed and grow fish an other games like
> that so I want to make a game where you play as some animal and you eat
> things to get bigger.

That is the original pitch. What follows turns it into something buildable.

**Nothing here is built yet.** Read
[../docs/TECHNICAL-DECISIONS.md](../docs/TECHNICAL-DECISIONS.md) first — it
carries the rules that apply to every game. The runnable reference for the
drawing technique is `../spikes/single-file-canvas-probe.html`.

Headings marked **[decided]** came from the design conversation and should not be
changed without asking. Headings marked **[proposal]** are starting points —
implement them, then tune by playing. Numbers in proposals are opening bids, not
requirements.

---

## What kind of game this is

An endless eat-to-grow roguelite. You swim, you eat things smaller than you, you
grow, and things bigger than you try to eat you. A run lasts a few minutes and
ends when you are eaten or you starve. Between runs you unlock new animals;
within a run you draft randomised upgrades.

The closest references are Hungry Shark for the feel and Feed and Grow for the
fantasy, with a roguelite draft layered on top. That draft is the thing that
makes it not just a clone.

---

## Core loop **[decided]**

1. **Free swim** in a 2D plane. Move anywhere, camera follows. **Not** forced
   auto-scroll — the player controls the pace.
2. **Hunger drains continuously.** Eating refills it. This is what stops the
   player from idling safely.
3. **Eat smaller creatures to grow.** Growth is the score and the power curve at
   the same time.
4. **Bigger creatures eat you.** Predators are the other half of the pressure.
5. **Run ends** on death by predator or starvation. Score is banked, unlocks
   progress, the run's upgrades are discarded.

Both pressures are present together and deliberately: hunger alone makes an
obstacle course, predators alone make eating risk-free.

---

## Two progression layers **[decided]**

This is the part to get right, because it is where the design differs from the
games it is inspired by.

### Persistent, across runs

- Unlock new **animals** at lifetime milestones.
- Each animal has **its own upgrade pool**, so playing a different animal is a
  different draft, not a reskin.
- Store lifetime bests and totals.

### Per run, discarded on death

- At each growth milestone the run pauses and offers a **choice of three
  upgrades**, drawn randomly from the shared pool plus the current animal's
  exclusive pool.
- Because the draw is random, no two runs play the same. This is the roguelite
  layer.

Keep the two layers strictly separate in the save file. Persistent state is
durable and versioned; run state is in memory and never written.

---

## Animals **[proposal]**

The instruction was "multiple animals with different eating rules that you
unlock at different levels", with per-animal upgrades. Different *rules* is the
requirement; the specific animals below are a proposal.

The design lever that makes them feel distinct is the **bite ratio** — how large
a creature you can swallow relative to your own mass. Everything else follows
from it.

| animal | unlock | bite ratio | speed | hunger drain | the twist |
|---|--:|--:|--:|--:|---|
| Reef shark | start | 1.0× | medium | medium | the baseline everything is judged against |
| Gulper | milestone 2 | 1.6× | slow | fast | swallows things bigger than itself, starves quickly |
| Pistol shrimp | milestone 4 | 0.6× | very fast | slow | can only eat small prey, but its boost stuns a predator |
| Something silly | milestone 6 | — | — | — | open: see "the silly question" below |

A bite ratio above 1.0 is the interesting case, because it inverts the normal
read of the screen: with the Gulper, a creature that looks too big is food.

### The silly question — open

The pitch says "a little silly" and "some animal", not specifically a shark. The
body plan does not care what the animal is, so this is a free choice and probably
the cheapest way to stand out from Hungry Shark. It has not been decided. Worth
answering before the fourth animal is built, not after.

---

## Run upgrades **[proposal]**

Draw three, pick one, at each growth milestone. A pool of around twenty is enough
for runs to feel distinct; below about twelve the draws start repeating
noticeably.

Shared pool, as a starting set:

- **Wider jaw** — bite ratio +0.15.
- **Slick skin** — top speed +12%.
- **Efficient gut** — hunger drain −15%.
- **Second wind** — survive one lethal hit per run.
- **Panic dash** — boost costs nothing for two seconds after being hit.
- **Chum sense** — prey within a radius is outlined, including through murk.
- **Growth spurt** — mass gained per meal +20%.
- **Thick hide** — predators need a 1.25× advantage to eat you rather than 1.0×.

Per-animal exclusives are where character lives. The Gulper might get an upgrade
that makes over-sized prey *heal* it; the pistol shrimp one that chains its stun.
Two or three exclusives per animal is enough.

Keep every upgrade a **number in a table**, applied by a single function that
folds the picks into the active stats. Do not scatter upgrade effects through the
simulation as special cases — that is the trap described under "Traps" below.

---

## Feel **[proposal]**

Feel is the whole game, and it is the one thing a spec cannot settle. These are
opening numbers; expect to change all of them by playing.

- **Steering toward a pointer**, with acceleration and drag rather than direct
  velocity. Water should feel like water: momentum carries, turns take time.
- **Turn rate falls as size grows.** A big animal being less nimble is what makes
  growth feel like a trade rather than a pure win.
- **Boost** on hold, with a cost — either hunger or a short cooldown. It should be
  the thing you spend to escape, so it must not be free.
- **Tail beat frequency tracks speed.** Cheap, and it is most of what sells the
  animation. `moon-rover` does the equivalent with its motor pitch.
- Camera **leads the direction of travel** slightly and pulls back as the player
  grows, so the screen shows more world as you get more dangerous.

One pattern worth stealing from `moon-rover` directly: it expresses every speed
threshold as a *fraction* of one top-speed constant, so changing that constant
rescales steering, camera and audio together and nothing breaks. Do the same here
with size — if every threshold is a fraction of current length, the game stays
coherent from 14 px to 400 px.

---

## Look **[proposal]**

The environment is where "good graphics" is won, and it is squarely a noise
problem: depth gradient, caustics, light shafts, murk that thickens with depth,
suspended particulate, kelp, a seabed. The spike has a working version of all of
it.

Two lessons already paid for, both in the spike's comments:

- **Eye radius must scale with the square root of body length.** Scaling it
  linearly gave a 150 px shark a dinner-plate eye and made it read as a cartoon
  minnow. Large animals have proportionally small eyes.
- **Never evaluate a noise field per-pixel at full resolution.** Its sample grid
  shows up as hard squares. Render light at 160×90 and let `drawImage` upscale
  it: the bilinear filter gives a smooth falloff for free, at 14k pixels a frame
  instead of a million.

A third, for this game specifically: **silhouette is the entire read at small
sizes.** Below roughly 40 px, surface detail is invisible and only the outline,
the tail shape and the teeth communicate anything. Spend effort there. Teeth in
particular are the signal for "this can eat me" and should stay legible when
almost nothing else is.

---

## Suggested file layout **[proposal]**

Following D2 — real modules, real files, no build step.

```
Sharky/
  index.html              shell, canvas, HUD markup
  manifest.webmanifest    PWA manifest
  sw.js                   service worker, precache, versioned cache name
  server.js               zero-dependency dev static server
  src/
    main.js               boot, run states, HUD, the frame loop
    core/
      rng.js              seeded PRNG + value noise (copy from moon-rover)
      input.js            pointer + touch + keyboard, one aim vector
      save.js             namespaced, versioned localStorage
      audio.js            procedural WebAudio, gated on a ready flag
    game/
      creature.js         THE body plan: one draw function, parametric species
      content.js          data only: animals, prey, predators, upgrades
      world.js            water, light layer, kelp, seabed, particulate
      play.js             simulation: movement, spawning, collision, hunger
```

`content.js` holding nothing but data is the important line. See the traps.

---

## Save schema **[proposal]**

Per D8: one namespaced key, a schema number, named fields, no array indices.

```js
localStorage['sharky.v1.profile'] = {
  schema: 1,
  bestScore: 0,
  bestMass: 0,
  runs: 0,
  totalEaten: 0,
  unlocked: { 'reef-shark': true },   // keyed by id, never by position
  lastAnimal: 'reef-shark'
}
```

Run state — current upgrades, current mass, current hunger — lives in memory only
and is never written.

Ship an export/import code (base64 of the JSON is enough) before the game is
sold, not after. Storage eviction is real and a lost profile in a paid game is a
refund request.

---

## Suggested build order **[proposal]**

Each step should end with something playable, because feel can only be judged by
playing.

1. **Swim.** Canvas, camera, one creature, pointer steering, water background.
   Stop and tune until moving around is pleasant with nothing else on screen. If
   this step is not fun, nothing later will fix it.
2. **Eat.** Prey spawning, collision, the bite ratio rule, growth, score.
3. **Pressure.** Hunger meter, predators that chase, death, run summary.
4. **Persist.** The save file, local best, the run-summary screen.
5. **Draft.** Growth milestones, the three-card upgrade pick, the shared pool.
6. **Animals.** A second animal with a genuinely different bite ratio, plus its
   exclusive upgrades, plus the unlock milestone.
7. **PWA.** Manifest, service worker, precache, and verify it runs with the dev
   server killed.
8. **Polish.** Procedural audio, feedback on the bite, murk and depth, the
   remaining animals.

Step 7 is deliberately late: it is packaging, and it is easier to precache a
finished file list than a moving one. But do not skip verifying it — see the
acceptance criteria.

---

## Acceptance criteria

The slice is done when all of these are true:

- A run can be played start to finish: swim, eat, grow, take an upgrade, die.
- Growing visibly changes how the game plays, not just a number on screen.
- Two animals play differently enough that a player would have a preference.
- Closing the tab and reopening restores the profile, and the best score is
  intact.
- **The game loads and plays with the dev server stopped.** This is the one that
  proves the delivery model, and it is easy to believe without checking. The
  method is in `../docs/PLATFORM-CONSTRAINTS.md`: precache, kill the server,
  reload, and confirm an uncached request fails while the game still runs.
- No `Math.random()` anywhere in simulation code (D9).
- Every storage key starts with `sharky.v1.` (D8).

---

## Traps

Specific, and each one has already cost someone time.

**Do not hardcode content into logic.** `moon-rover`'s `ARCHITECTURE.md` says of
its own mission system: *"Fix this before writing story content, not after. Each
mission added before the refactor makes the refactor more expensive."* Its
objectives are nine hand-wired ids plus comparisons against a campaign index.
Upgrades and animals here are exactly that shape. Keep them as data in
`content.js`, applied by one function. The moment an upgrade is implemented as an
`if` inside the movement code, the pool stops being extensible.

**Do not key saves by array index** (D8). The same document records flags landing
on the wrong objects after world generation changed.

**Do not use `navigator.onLine`** to detect offline. It reported `true` in testing
while the server was dead.

**Do not promise offline play on first load.** A page that registers its service
worker during load is not controlled by it until the next load.

**Gate all audio on a ready flag.** An `AudioContext` starts `suspended` and
needs a user gesture; menu interactions will reach audio before the game starts.

**Do not solve creature art with noise** (D6). Noise makes water and rock. It does
not make an animal with a face.
