---
name: game-qc
description: Quality-control orchestrator for a game in this repo. Runs mechanical gate 0 and a browser suite (console errors, etc.), then spawns a fresh polish critic (game-playtest) that judges art/finish and pitch match so the owner only reviews near-final builds. Up to three builder response rounds. Use before claiming playable/done/ready.
---

# Game QC (orchestrator)

**Owner goal:** less human time on half-baked games; more near-final builds
ready for a short owner review.

Split of labor:

| Layer | Who | What |
|---|---|---|
| Gate 0 | you + `check-game.mjs` | House rules, smoke exit 0 |
| Browser mechanical suite | **you** (Playwright / browser tools) | Console errors and other automatable browser checks |
| Polish critic | **fresh** `game-playtest` agent | Art style, finish, pitch match, feel; `ready_for_owner` vs `not_ready` |

You do **not** polish-score your own build. The critic does not debug consoles.

A PR must not claim **playable** / **done** / **ready** unless:

1. Gate 0 is green.
2. Browser mechanical suite is green (logged in the PR).
3. `<Game>/PLAYTEST.md` covers the current short SHA.
4. Critic polish verdict is **`ready_for_owner`**.
5. Playability sanity in PLAYTEST.md is PASS.
6. Recording + art/motion review is cited.
7. Gate 2 meets the brief's `done_pct` with no zero on F1–F7 (unless the
   owner accepts a lower bar for this version).

---

## Step 0 — QC brief

Open `<Game>/<GAME>PLAN.md` → `## QC brief`.

- **Present:** continue.
- **Missing / blank:** run gate 0 only, ask the `new-game` questionnaire
  (always ask `tone`), stop. Do not spawn the critic.

Keep the **original pitch** for the critic prompt.

---

## Step 1 — Gate 0

```bash
node .cursor/skills/game-qc/scripts/check-game.mjs <Game>
```

Fix every `FAIL`. Smoke stays per-game (no arcade-only contract).

`PLAYTEST.md` must not be in `sw.js` PRECACHE.

---

## Step 1b — Browser mechanical suite (you, not the critic)

Start the server:

```bash
SESSION_NAME="<game>-dev"
tmux -f /exec-daemon/tmux.portal.conf has-session -t "=$SESSION_NAME" 2>/dev/null \
  || tmux -f /exec-daemon/tmux.portal.conf new-session -d -s "$SESSION_NAME" -c "$PWD/<Game>" -- npm start
```

Using Playwright / browser tools against `http://localhost:<port>`, **fail
closed** on:

1. **Console errors** across load → start → ~20 s play → die/end → restart.
   Zero `error`-level console messages (page errors and failed module loads).
   Warnings may be noted; errors fail the suite.
2. Optional but recommended while you are here: confirm the document title
   loads and the canvas/main shell is present (smoke against a blank page).

Paste a short transcript into the PR (`### Browser suite`). Do **not** ask
the critic to re-do console hunting.

If this suite fails, fix and re-run before spawning a critic.

> Later: these checks can move into a dedicated script when we have a
> zero-drama way to run them in CI. Until then, this step *is* the suite.

---

## Step 2 — Spawn the polish critic (fresh agent)

Spawn a **new** agent (`computerUse` / browser-capable). Point it at
`.cursor/skills/game-playtest/SKILL.md`. Paste pitch, brief, port, sha, and
`Mechanical suite: PASSED`.

**Do not** run `game-playtest` in the builder context.

**If you cannot spawn** (common for cloud builder subagents with no Task /
computerUse tools):

1. Write `<Game>/CRITIC_SPAWN.md` containing the full spawn prompt (pitch,
   brief, URL, branch, “Mechanical suite: PASSED”).
2. Push the branch. Do **not** self-playtest and do **not** invent PLAYTEST.md.
3. Stop QC here. Tell the parent/owner to spawn a fresh critic with that
   file. Resume at Step 3 when PLAYTEST.md appears.
4. If you also lack PR-creation tools (`ManagePullRequest` / `gh` write),
   push the branch and paste a compare URL; the parent opens the PR.

Wait for `<Game>/PLAYTEST.md`. Commit it if needed.

---

## Step 3 — Read the critic report

- `blocked:*` → resolve and restart.
- `not_ready` → builder must raise finish/art/intent; counts as a round.
- `ready_for_owner` with playability PASS → eligible for owner review when
  scores also meet threshold.
- Design/content complaints are in scope when they fit pitch/brief.

---

## Step 4 — Builder response rounds (max 3)

For each round (1…3):

1. Fix top complaints (polish/art first, then feel, then content vs pitch).
2. Re-run gate 0 + browser suite if you touched shipped files or UI boot.
3. Append `## Builder response` → `### Round N` (do not edit critic scores).
4. Re-spawn **fresh** `game-playtest` for a new verdict + recording.

Stop when `ready_for_owner` + score threshold, or after 3 rounds → ping owner
with PLAYTEST.md (even if still `not_ready`).

---

## Step 5 — PR report

```markdown
## QC report — <Game> @ <short sha>

Brief: …

### Gate 0
check-game: PASS / FAIL

### Browser suite (orchestrator)
Console errors load→play→end→restart: 0 / FAIL — <notes>

### Critic (game-playtest)
PLAYTEST.md: …
Polish verdict: ready_for_owner / not_ready
Playability: PASS / FAIL
Gate 2: __/__ = __ %
Recording + art/motion review: <link>
Intent: match / partial / miss

### Builder rounds
…

### Owner handoff
Worth human review: yes / no
```

---

## When the owner approves

Follow "How the reference moves" in `docs/QUALITY-BAR.md`. Never self-promote.
