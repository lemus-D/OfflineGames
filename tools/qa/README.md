# tools/qa — bots play, probes measure, agents read the report

Dev-only. Never shipped with a game, never precached.

```bash
cd tools/qa && npm run setup                    # once: Playwright (+ its ffmpeg, for recordings)
node tools/qa/run.mjs GroveRun                  # both tiers, 20 seeds per matchup
node tools/qa/run.mjs GroveRun --tier bots      # headless only, no browser
node tools/qa/run.mjs GroveRun --tier probes    # browser only
node tools/qa/run.mjs GroveRun --final          # final critic round: + recording.webm, filmstrip
node tools/qa/run.mjs GroveRun --replay-from <label>   # replay an earlier run's exact inputs
node tools/qa/compare.mjs GroveRun <before> <after>    # side-by-side of two runs
cd tools/qa && npm test                         # the harness's own tests, on toy games
```

Playwright uses the system Chrome when there is one.

Output goes to `tools/qa/out/<Game>/<short sha>[-dirty]/` (git-ignored):

| File | For |
|---|---|
| `report.md` | The short summary an agent or the owner reads: checks, bot table, key moments. |
| `results.json` | Everything: metrics per matchup, every check, the replays used. |
| `moments/*.png` | Key-moment screenshots, same seed and inputs every build. |
| `moments/filmstrip.png` | `--final`: 16 consecutive frames ~0.1 s apart, for a motion review. |
| `recording.webm` | `--final`: 30 s of real-time play, for the owner. |

Exit code 1 if any check fails. The same commands work for every game, from
Cursor, Claude Code or a terminal. No LLM is involved in anything here.

## Where it sits in QC

`game-qc` runs gate 0, then this harness until it has no `FAIL` (free), and
only then spawns a fresh critic agent on `report.md` and the screenshots:

| Agent | Platform files | Model | When |
|---|---|---|---|
| `game-critic` | `.claude/agents/`, `.cursor/agents/` | small (Claude Code: `haiku`) | each round |
| `game-art-director` | same | large (Claude Code: `opus`) | final round only |

Both follow the `game-playtest` skill. Skills live in `.cursor/skills/`, and
`.claude/skills` links there, so both platforms read one copy. The agent
files only set model, tools and turn cap. Cursor's files inherit the parent
model until you set an id from Cursor's model picker.

## Tier 1 — bots

Each genre profile defines a ladder of bots. Search bots try every action on
copies of the session and keep the one whose futures score best for their
seat, so no game needs a hand-written AI.

**`arcade`** — every rung plays alone, 20 seeds each.

| Bot | Question |
|---|---|
| `idle` | Does doing nothing lose? |
| `random` | What is the floor? |
| `humanish` | Short lookahead, 0.25 s reaction, 5 % noise. Does a decent run fit the brief? |
| `searcher` | Longer lookahead. Is everything reachable and survivable? |

Checks: idle loses, skill matters, run length in `run_band`, a strong player
lasts, difficulty has a ceiling, first reward is reached early, plan events,
invariants.

**`turn`** — no idle rung (passing is rarely a move).

| Bot | |
|---|---|
| `random` | the floor |
| `humanish` | one move of lookahead, 15 % mistakes |
| `searcher` | three moves of lookahead (both sides), more rollouts |

- `seats: 2` — every rung plays every rung, in both seats. Checks: games
  finish, searcher beats random, the ladder is ordered, first-seat advantage,
  draw rate, game length.
- `seats: 1` with the game's own AI — each rung plays each `variant` (e.g.
  difficulty, easiest first). Checks: games finish, skill gap, ladder
  ordered, harder variants really are harder, the hardest is beatable.

## Tier 2 — probes

Chromium drives the real page: console errors, blank or black canvas, canvas
not repainted each frame (ghosting), layout at desktop / portrait /
landscape, frame time under 4× CPU throttle, audio audible after the first
tap, the brief's input families, offline boot, draw rules, and key-moment
screenshots replayed from a Node bot run and paused on exact ticks.

## Adding a game

Four small pieces, all written or copied by the build agent at scaffold
time. `GroveRun` is the worked example.

### 1. `<Game>/qa/adapter.mjs`

Translates the game for the harness. No strategy goes here.

| Member | Meaning |
|---|---|
| `profile` | `'arcade'` or `'turn'` |
| `fixedDt` | the simulation's fixed step, usually `FIXED_DT` |
| `ticksPerDecision` | arcade: decide every N ticks. Turn-based: give `awaitingDecision(session)` instead |
| `seats`, `seat(session)` | turn-based with two sides: `2`, and whose move it is. Default one seat |
| `variants` | optional, e.g. `['easy', 'hard']` — passed to `create` |
| `create(seed, variant)` | a fresh session |
| `actions(session)` | what the deciding player can do now. **`[0]` is "do nothing" / the default move** |
| `tick(session, action)` | one fixed step. `action` is `null` between decisions. Must accept any action `actions()` ever returns |
| `time(session)` | game seconds elapsed |
| `score(session, seat)` | higher is better for `seat` — usually the HUD score |
| `terminal(session)` / `outcome(session)` | run over? `{ result: 'death' \| 'win' \| 'lose' \| 'draw' \| 'end', cause, winner }` — `winner` is a seat index for two-seat games |
| `drainEvents(session)` / `mapEvent(raw)` | raw events → shared vocabulary: `reward`, `damage`, `danger`, `death`, `input`, `win`, `lose`, `turn_end`, `level_end` (`null` drops one) |
| `observe(session)` | plain numbers describing the state; used for determinism and NaN checks |
| `invariants(session)` | names of anything that must never be true right now; `[]` when fine |
| `clone(session)` | optional. By default sessions are deep-copied |

The default copy needs the game's `src/core/rng.js` to expose `clone()` (the
scaffold version does). The self-check fails loudly if copies drift.

### 2. `src/core/qa.js`

Copy `tools/qa/templates/qa.js` unchanged and add it to `sw.js` PRECACHE. It
does nothing unless the URL has `?qa=1`. Then wire it in:

| Where | Call |
|---|---|
| `main.js` boot | `qa.expose({ state: () => state })` — state is `'menu'`, `'playing'` or `'summary'` |
| top of each frame | `qa.beginFrame()` |
| starting a run | `const seed = qa.seed(timeSeed)`; games with variants also `qa.variant(chosen)` |
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

Turn-based keys: `turns: [lo, hi]` or `secondsPerTurn` (game length),
`skillWinRate`, `skillGap`, `seatTolerance`, `maxDrawRate`, `maxTurns`.

Rect rules: `visible`, `onScreen`, `minSize` (`px`), `hudClear`, and
`below` / `above` / `leftOf` / `rightOf` (`a` relative to `b`). Keep a `why`
on each so the report says what it protects.

When the owner hand-fixes something new, the fix becomes a rule here or a
probe, so the same complaint never needs a human twice.

## Comparing builds

`compare.mjs` writes `out/<Game>/compare/<before>__<after>/`: checks that
changed, numbers that moved (put them in the commit message), one A|B image
per key moment for the critic, and `index.html` for a person.

Pairs are the **same instant of the same play** when both runs had the same
inputs: always for a drawing-only change. After a gameplay change the bot
plays differently, so re-run the new build with `--replay-from <before>` to
force the old inputs. `compare.md` says which case it is. Small vision
models judge "which side is better" far more reliably than they score one
image.
