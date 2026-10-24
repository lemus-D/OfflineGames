---
name: new-game
description: Start a new game in this repo from a pitch. Asks the owner a short questionnaire (the QC brief) instead of guessing taste calls, settles the design in a short plan, copies the house scaffold from the reference game, and sets the build order so the first version is a playable PWA that passes game-qc. Use when the user describes a game that does not exist yet, or asks to build a game from a plan file.
---

# New game

Goal: go from a pitch to a playable, installable, honest MVP in one pass,
shaped like every other game here so `game-qc` can judge it.

## Before writing anything

Read, in this order:

1. `AGENTS.md` — standards and house layout.
2. `docs/TECHNICAL-DECISIONS.md` — do not re-decide D1–D9.
3. `docs/QUALITY-BAR.md` — know what you will be judged on. F1, F3, F5, F6
   and F9 are the ones that have to be designed in; they are expensive to add
   after.
4. The scaffold reference: **`Apex/`** (its `APEXPLAN.md`, `smoke.mjs`,
   `src/game/play.js`, `src/main.js`). For touch input and audio, which Apex
   lacks, read `Sharky/src/core/input.js` and `Sharky/src/core/audio.js`.
5. If a `<GAME>PLAN.md` already exists for this game, it is the spec. Headings
   marked **[decided]** are not yours to change.

## Step 1 — The questionnaire

Before writing the plan, get the owner's answers to the **QC brief** fields
defined in `docs/QUALITY-BAR.md` ("The QC brief"). These are the parts of the
bar that are the owner's taste, and `game-qc` will score against them later,
so guessing here means being graded against a guess.

How to ask:

- First read the pitch and any existing plan. Pre-fill every field the
  pitch already answers and say which ones you pre-filled.
- For the rest, ask them **in one message** as a short numbered list, each
  with the proposed default in brackets so the owner can reply "defaults" or
  answer only the ones they care about. `tone` has no default; always ask it.
- Use the question tool if the environment has one. If it does not, put the
  list at the end of your turn, build nothing that depends on the answers,
  and stop. Do not fill the brief in silently and carry on.
- A pitch-level question that changes the whole build (free movement vs
  auto-scroll, run-based vs persistent world) belongs in the same message.

The questionnaire, verbatim:

```
Before I build <Game>, a few calls that are yours, not mine
(reply "defaults" to take all the brackets):

1. Shape — real-time arcade / turn-based / physics-puzzle  [real-time arcade]
2. Run length a good run should last  [45 s – 4 min]
3. Inputs required for this version — keyboard / touch / both  [both]
4. Orientation — portrait / landscape / any  [any]
5. Sound for this version — none / minimal (action, reward, fail) / full (+ambience)  [minimal]
6. Done threshold for gate 2  [70 %]
7. Tone — one line: how silly or serious, palette or references  [no default]
8. What persists between runs  [best score]
9. Anything explicitly out of scope for this version  [none]
```

Write the answers into the plan's `## QC brief` section exactly as given,
marking each **[owner]** or **[default]**.

## Step 2 — Settle the design in a plan

Write `<Game>/<GAME>PLAN.md` from `references/GAMEPLAN-template.md` before
any code. Keep it under 120 lines. It must answer:

- **The verb** — the one thing the player does, in four words or fewer.
- **The pressure** — what forces the player to act (a meter, a chaser,
  rising speed). Idle must lose.
- **The fail state and the run length band** — see F5.
- **The one-more-go hook** — what persists between runs and what the summary
  will say.
- **Controls** — one line per input family the brief requires. Default is
  both keyboard and touch.
- **Content tables** — what rows live in `content.js` and what each row
  changes about *how you play* (F10). If a row only changes a number, say so.
- **Feedback plan** — the player-facing events and the sound/visual each
  gets (F3, F9).
- **Non-goals** for the MVP.

The brief questions were asked in step 1. Everything else in the plan: pick,
mark it **[proposal]**, move on. Numbers in proposals are opening bids.

## Step 3 — Scaffold by copying

Copy from `Apex/`, then rename. Nothing is shared at runtime (D7).

| File | Copy from | Change |
|---|---|---|
| `server.js` | Apex | banner name, default port — next free (see `AGENTS.md` table; 5184 as of writing) |
| `sw.js` | Apex | `CACHE = '<game>-v1'`, rewrite `PRECACHE` for your files |
| `manifest.webmanifest` | Apex | name, description, colours, draw a new inline SVG icon |
| `package.json` | Apex | `name` |
| `index.html` | Apex | title, inline icon, HUD markup, hint line, palette |
| `src/core/rng.js` | Apex (or Sharky if you need noise) | nothing |
| `src/core/save.js` | Apex | `PROFILE_KEY = '<game>.v1.profile'`, `DEFAULT_PROFILE` fields |
| `src/core/input.js` | **Sharky** | map to your controls; keep the families the brief requires (default: pointer + touch + keyboard) |
| `src/core/audio.js` | **Sharky** | your sound set at the brief's level; skip the file only if the brief says `sound: none` |
| `src/game/content.js` | Apex | your tables; keep `FIXED_DT` here |
| `src/game/play.js` | Apex | your `PlaySession` |
| `src/game/draw.js` | Apex | your art |
| `src/main.js` | Apex | wiring |
| `smoke.mjs` | Apex | your assertions |

Check the directory name and the storage prefix against the table in
`AGENTS.md` so they do not collide with an existing game.

## Step 4 — Build in this order

The order matters because each step is testable without the next.

1. **`content.js`** — tables and constants. No logic.
2. **`play.js`** — `PlaySession` with the house signature:
   `constructor(seed, ...)`, `step(frameDt, controls)` accumulating into
   `_fixedStep(FIXED_DT, controls)`, plain state fields the renderer reads.
   No DOM, no canvas, no `Math.random`. Events the player should feel go
   into a small queue (`this.events.push({ kind: 'eat', x, y })`) that the
   frame loop drains for sound and particles.
3. **`smoke.mjs`** — drive the session headlessly *now*, before there is a
   picture: same seed + same inputs → same state; idle loses within 30 s;
   a scripted player makes progress; a run ends with a summary. Add the
   `Math.random` file scan. Run it. Keep it green from here on.
4. **`draw.js`** — render from session state. Palette first, player
   silhouette second, background depth third, then particles.
5. **`main.js`** — frame loop, DOM HUD, menus, summary with a near-miss line,
   SW registration. Drain the event queue into `audio` and `draw` here.
6. **`input.js`** — the brief's input families. If touch is one of them,
   test the layout at 390 × 844 before tuning anything else.
7. **`audio.js`** — the brief's sound level, started on first gesture.
8. Rewrite `PRECACHE`, bump the cache name.

## Step 5 — Hand off to QC

Run the `game-qc` skill. It will run gate 0, then spawn a fresh
`game-playtest` critic (pitch + recording + `PLAYTEST.md`), then up to three
builder response rounds. Do not open or update the PR as "playable" until
gate 0 is green, PLAYTEST.md exists with gate 1 PASS, a recording/motion
review is cited, and gate 2 meets the brief's `done_pct`.

## Things that have gone wrong before

- Precache list missed a new module → the game worked online and 404'd
  offline. `check-game.mjs` catches it; run it.
- Two games on one port (`Break`, `RabbitRun` on 5183).
- Keyboard-only input shipped as "MVP" on a mobile-shaped product (`Apex`)
  without anyone deciding that. Deciding it is fine; it goes in the brief.
- Silent games. Four of five, none of them by decision. If the owner wants
  silence for a version, the brief says `sound: none`; otherwise add audio
  in step 7, not "later".
- `Math.random()` creeping into `draw.js` for sparkle jitter. Use
  `hash2i(x, y, seed)` from `rng.js`; it is deterministic and looks the same.
