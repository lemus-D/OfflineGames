---
name: game-qc
description: Quality-control orchestrator for a game in this repo. Runs gate 0, then the tools/qa harness (bot ladder + browser probes — free, no LLM), fixes until it is green, and only then spawns a fresh polish critic (game-critic agent, game-playtest skill) on the harness report and key-moment screenshots. Up to three builder rounds; the last one adds a recording and an art-director pass. Use before claiming a game is playable, done or ready.
---

# Game QC (orchestrator)

**Owner goal:** the owner only reviews near-final builds, and model credits
are spent on taste, not on things code can measure.

| Layer | Who | Cost | What |
|---|---|---|---|
| Gate 0 | you, `check-game.mjs` | free | House rules, smoke exit 0 |
| Harness | you, `tools/qa/run.mjs` | free | Bots over 20 seeds; console, canvas, ghosting, layout, frame time, audio, inputs, offline, draw rules; key-moment screenshots |
| Critic | **fresh** `game-critic` agent | small model | Art, finish, pitch match from the report and screenshots |
| Art director | **fresh** `game-art-director` agent | big model, final round only | Same skill, plus motion from the filmstrip |

You never score your own build. The critic never re-measures what the
harness measured.

A PR must not claim **playable** / **done** / **ready** unless:

1. Gate 0 is green.
2. The harness run for the current short SHA has no `FAIL`.
3. `<Game>/PLAYTEST.md` covers that SHA with verdict **`ready_for_owner`**
   from the final-round art director.
4. The PR body has the QC report below.

---

## Step 0 — Brief and adapter

Open `<Game>/<GAME>PLAN.md` → `## QC brief`. Missing or blank: run gate 0,
ask the `new-game` questionnaire (always ask `tone`), stop.

`<Game>/qa/adapter.mjs` missing: write it now (contract and worked example
in `tools/qa/README.md`), with `src/core/qa.js` and the two `data-qa`
attributes. Turn the plan's promises into `qa/expect.json`. Keep the
original pitch for the critic.

## Step 1 — Gate 0

```bash
node .cursor/skills/game-qc/scripts/check-game.mjs <Game>
```

Fix every `FAIL`.

## Step 2 — Harness until green

```bash
cd tools/qa && npm run setup     # once per machine
node tools/qa/run.mjs <Game>
```

Read `tools/qa/out/<Game>/<sha>/report.md`. Every `FAIL` is a bug or a
missed promise; fix it and re-run. This loop costs nothing, so do not spawn
a critic while anything fails.

- A check you believe is wrong for this game (the brief says otherwise):
  change `qa/expect.json` with a `why`, and say so in the PR. Never delete a
  check to get green.
- `WARN` lines go in the PR; they do not block.
- **Every fix is verified, not claimed.** Run the harness on the commit
  before and after and
  `node tools/qa/compare.mjs <Game> <before> <after>`; put the numbers that
  moved in the commit message (rule 6). This is how a fix that did not work
  gets caught before anyone looks at it.

## Step 3 — Critic round

Spawn a **fresh** agent, never the builder context:

- Claude Code: the `game-critic` subagent (`.claude/agents/`).
- Cursor: the `game-critic` subagent (`.cursor/agents/`).
- Neither available: write `<Game>/CRITIC_SPAWN.md` with the spawn prompt
  from the `game-playtest` skill, push, stop, and tell the owner. Do not
  self-playtest. Resume when PLAYTEST.md appears.

Give it the spawn prompt from the `game-playtest` skill: pitch, brief, run
label, previous round's label (if any), round type `round`.

## Step 4 — Builder rounds (max 3)

Read PLAYTEST.md.

- `blocked: …` → fix what it names; restart at the step it points to.
- `not_ready` → fix the top complaints (polish and art first, then feel,
  then content against the pitch). Re-run the harness until green, run
  `compare.mjs` against the critic's run, append `## Builder response →
  ### Round N` (never edit the critic's verdict), commit, re-spawn a fresh
  critic with the previous label.
- `ready_for_owner` from a `round` critic → go to step 5.

After round 3 still `not_ready`: stop and send the owner PLAYTEST.md and the
latest compare.

## Step 5 — Final round

```bash
node tools/qa/run.mjs <Game> --final
```

This adds `recording.webm` (for the owner) and `moments/filmstrip.png` (for
the motion review). Spawn a fresh **`game-art-director`** with round type
`final`. Its verdict is the one the PR quotes.

## Step 6 — PR report

```markdown
## QC report — <Game> @ <short sha>

Brief: shape=… run_band=… inputs=… orientation=… sound=… done_pct=…

### Gate 0
check-game: PASS

### Harness — tools/qa/out/<Game>/<sha>/report.md
Checks: <n> PASS, <n> WARN (<which>), 0 FAIL
Bots: humanish p50 __ s (run_band __–__), searcher p10 __ s, idle p90 __ s
     (turn-based: searcher beats random __ %, seat balance __ %)
Recording: tools/qa/out/<Game>/<sha>/recording.webm

### Critic rounds
Round 1 (<label>): not_ready — <top reason>
Round 2 (<label>): … — compare: <path>
Final (<label>, game-art-director): ready_for_owner

### Owner handoff
Worth human review: yes / no — <one line>
```

## When the owner approves

Follow "How the reference moves" in `docs/QUALITY-BAR.md`. Never self-promote.
