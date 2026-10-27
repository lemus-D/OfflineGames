# tools/qa — bots play, probes measure, agents read the report

Dev-only. Never shipped with a game, never precached.

```bash
cd tools/qa && npm install                      # once: Playwright (uses system Chrome if present)
node tools/qa/run.mjs GroveRun                  # both tiers, 20 seeds per bot
node tools/qa/run.mjs GroveRun --tier bots      # headless only, no browser
node tools/qa/run.mjs GroveRun --tier probes    # browser only
cd tools/qa && npm test                         # the harness's own tests, on a toy game
```

Output goes to `tools/qa/out/<Game>/<short sha>[-dirty]/` (git-ignored):

| File | For |
|---|---|
| `report.md` | The short summary an agent or the owner reads. Checks, bot table, key moments. |
| `results.json` | Everything: metrics per bot, every check, the replays used. |
| `moments/*.png` | Key-moment screenshots, same seed and inputs every build. |

Exit code 1 if any check fails. The same command works for every game, from
Cursor, Claude Code or a terminal. No LLM is involved in anything here.

## The two tiers

**Tier 1 — bots.** Four bots play the simulation headless, 20 seeds each,
through the game's adapter. Search bots try every action on copies of the
session and keep the one whose futures score best, so no game needs a
hand-written AI.

| Bot | Question |
|---|---|
| `idle` | Does doing nothing lose? |
| `random` | What is the floor? |
| `humanish` | Short lookahead, 0.25 s reaction, 5 % noise. Does a decent run fit the brief? |
| `searcher` | Longer lookahead. Is everything reachable and survivable? |

The gaps between them are the findings: idle lasting as long as the searcher
means no pressure; random scoring like humanish means skill does not matter.

**Tier 2 — probes.** Chromium drives the real page: console errors, blank or
black canvas, canvas not repainted each frame (ghosting), layout clipping at
desktop / portrait / landscape, frame time under 4× CPU throttle, audio
actually audible after the first tap, required input families, offline boot,
and key-moment screenshots replayed from a Node bot run and paused on exact
ticks.

## Adding a game

Four small pieces, all copied or written by the build agent at scaffold time.

### 1. `<Game>/qa/adapter.mjs`

Translates the game for the harness. No strategy goes here.

| Member | Meaning |
|---|---|
| `profile` | `'arcade'` (more profiles to come: turn-based, level-based) |
| `fixedDt` | the simulation's fixed step, usually `FIXED_DT` |
| `ticksPerDecision` | arcade: decide every N ticks. Turn-based games instead give `awaitingDecision(session)` |
| `create(seed)` | a fresh session |
| `actions(session)` | what a player can do now. **`[0]` is "do nothing"** |
| `tick(session, action)` | one fixed step. `action` is `null` between decisions. Must accept any action `actions()` ever returns |
| `time(session)` | game seconds elapsed |
| `score(session)` | higher is better — usually the HUD score |
| `terminal(session)` / `outcome(session)` | run over? `{ result: 'death' \| 'win' \| 'lose' \| 'end', cause }` |
| `drainEvents(session)` / `mapEvent(raw)` | raw events → shared vocabulary: `reward`, `damage`, `danger`, `death`, `input`, `win`, `lose`, `turn_end`, `level_end` (return `null` to drop) |
| `observe(session)` | plain numbers describing the state; used for determinism and NaN checks |
| `invariants(session)` | names of anything that must never be true right now; `[]` when fine |
| `clone(session)` | optional. By default sessions are deep-copied |

The default copy needs the game's `src/core/rng.js` to expose `clone()` (the
scaffold version does). The self-check fails loudly if copies drift.

`GroveRun/qa/adapter.mjs` is the worked example.

### 2. `src/core/qa.js`

Copy `tools/qa/templates/qa.js` unchanged and add it to `sw.js` PRECACHE. It
does nothing unless the URL has `?qa=1`. Then wire it in:

| Where | Call |
|---|---|
| `main.js` boot | `qa.expose({ state: () => state })` — state is `'menu'`, `'playing'` or `'summary'` |
| top of each frame | `qa.beginFrame()` |
| starting a run | `const seed = qa.seed(timeSeed)` |
| stepping | `if (qa.replaying()) qa.step(session, dt); else session.step(dt, controls);` |
| draw calls | pass `qa.clock(animTime)` as the animation time |
| draining events | `qa.record(ev)` for each raw event |
| draw code | `qa.rect(role, x, y, w, h)` for `'player'`, `'hazard'`, `'pickup'` and any role expect.json names |

### 3. `index.html`

`data-qa="start"` on the button that starts a run, `data-qa="hud"` on the
in-run HUD overlay. `server.js` must take the port as its first argument.

### 4. `<Game>/qa/expect.json` (optional)

The plan's own promises, as numbers. Everything else comes from the QC brief
(`run_band`, `inputs`, `orientation`, `sound`) and the profile's defaults.

```json
{
  "firstRewardS": 5,
  "idleDiesWithinS": 30,
  "skillRatio": 2,
  "minSpritePx": 24,
  "frameP95Ms": 50,
  "events": [{ "bot": "humanish", "kind": "reward", "minPerMin": 6, "why": "…" }],
  "rects":  [{ "rule": "below", "a": "fox", "b": "player", "why": "…" }],
  "bots":   { "humanish": { "reactionS": 0.3 } }
}
```

Rect rules: `visible`, `onScreen`, `minSize` (`px`), `hudClear`, and
`below` / `above` / `leftOf` / `rightOf` (`a` relative to `b`). Each rule
keeps a `why` so the report says what it protects.

When the owner hand-fixes something new, the fix becomes a rule here or a
probe, so the same complaint never needs a human twice.

## Comparing builds

Key moments come from the same bot run every time (seed 1, `humanish`), so
`out/<Game>/<shaA>/moments/first-reward.png` and
`out/<Game>/<shaB>/moments/first-reward.png` show the same instant. A critic
compares them pairwise ("which reads the chase better?"), which small vision
models do far more reliably than scoring one image.
