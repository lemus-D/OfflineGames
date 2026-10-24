---
name: game-qc
description: Quality-control orchestrator for a game in this repo. Reads the QC brief (asking if missing), runs mechanical gate 0, spawns a fresh game-playtest critic (pitch + recording + PLAYTEST.md), then runs up to three builder response rounds that may fix feel and design/content. Use before claiming a game or change is playable, done, or ready, and when the owner asks for QC.
---

# Game QC (orchestrator)

The bar is `docs/QUALITY-BAR.md`. The critic procedure is the
`game-playtest` skill (`.cursor/skills/game-playtest/`).

You (the builder / QC orchestrator) **do not grade your own build** for
gates 1–2. You run gate 0, spawn a fresh critic, then respond to
`<Game>/PLAYTEST.md` for at most **3** rounds.

A PR must not claim **playable** / **done** / **ready** unless:

1. Gate 0 is green.
2. `<Game>/PLAYTEST.md` exists for the current short SHA (or clearly covers
   that SHA).
3. The critic recorded gameplay and ran a motion review (paths cited in
   PLAYTEST.md).
4. Gate 1 in PLAYTEST.md is PASS.
5. Gate 2 meets the brief's `done_pct` with no zero on F1–F7 (unless the
   owner explicitly accepts a lower bar for this version).

---

## Step 0 — QC brief

Open `<Game>/<GAME>PLAN.md` → `## QC brief`.

- **Present:** continue.
- **Missing / blank:** run gate 0 only, then ask the owner the questionnaire
  from `new-game` (defaults in brackets; always ask `tone`). Do not spawn
  the critic and do not invent brief fields. Write answers into the plan
  before continuing.

Also keep the **original pitch** (plan blockquote) handy — the critic needs
it verbatim.

---

## Step 1 — Gate 0 (you run this)

```bash
node .cursor/skills/game-qc/scripts/check-game.mjs <Game>
```

Fix every `FAIL` before spawning a critic. Warnings: note them in the PR.

Smoke stays per-game; do not impose an arcade-only assert contract (owner
decision). You may still improve a thin smoke if you are already touching
that game, but it is not a QC blocker beyond exit 0.

`PLAYTEST.md` is **not** a shipped asset: it must not appear in `sw.js`
PRECACHE (the checker fails if it does).

---

## Step 2 — Spawn the playtest critic (fresh agent)

Start the game server if needed:

```bash
SESSION_NAME="<game>-dev"
tmux -f /exec-daemon/tmux.portal.conf has-session -t "=$SESSION_NAME" 2>/dev/null \
  || tmux -f /exec-daemon/tmux.portal.conf new-session -d -s "$SESSION_NAME" -c "$PWD/<Game>" -- npm start
```

Spawn a **new** agent with no builder context. Prefer `computerUse` (or
another browser-capable subagent). Point it at
`.cursor/skills/game-playtest/SKILL.md` and paste the pitch + brief + port +
sha. Use the spawn prompt block in that skill.

**Do not** run `game-playtest` yourself in the same context that wrote the
game. If you cannot spawn a subagent, **stop** and ask the owner to run
playtest in a fresh agent/chat. Do not fill PLAYTEST.md as the builder
except for appending `## Builder response` after a real critic pass.

Wait for `<Game>/PLAYTEST.md`. Commit it if the critic did not.

---

## Step 3 — Read the critic report

- If `blocked: no QC brief` → back to Step 0.
- If gate 1 FAIL → fix those issues first (still counts as a response round).
- Complaints include design/content — they are in scope when they fit the
  brief and pitch. Escalate to the owner only when the fix would change
  `non_goals` or contradict a **[decided]** plan heading.

---

## Step 4 — Builder response rounds (max 3)

For each round (1…3):

1. Take the top open complaints (feel **and** design/content).
2. Fix them in the game (constants preferred for feel; real content/design
   changes when the pitch/brief requires them).
3. Re-run gate 0 / smoke if you touched sim or shipped files; bump SW cache
   when precached files change.
4. Append under `## Builder response` → `### Round N` in PLAYTEST.md what
   you changed and the commit SHAs. **Do not edit** the critic's scores or
   complaint list above that section.
5. **Re-spawn** `game-playtest` (fresh critic again) so scores and the
   recording are redone on the new build. Append a new critic pass / overwrite
   per the playtest skill's history rules.

Stop early when:

- Gate 1 PASS, gate 2 ≥ `done_pct`, no F1–F7 at 0, and the critic's top
  issues are addressed or explicitly deferred by the owner, or
- 3 rounds are exhausted → ping the owner with PLAYTEST.md + what remains.

---

## Step 5 — PR report

Paste into the PR body (in addition to linking PLAYTEST.md):

```markdown
## QC report — <Game> @ <short sha>

Brief: shape=<…> run_band=<…> inputs=<…> sound=<…> done_pct=<…>

### Gate 0
check-game: PASS / FAIL (warnings: …)
smoke: exit 0

### Critic (game-playtest)
PLAYTEST.md: <path> (sha covered: …)
Gate 1: PASS / FAIL
Gate 2: __/__ = __ % (threshold __ %)
Recording + motion review: yes / no — <link>
Intent: match / partial / miss

### Builder rounds
Round 1: … (commits …)
Round 2: …
Round 3: …
Stopped because: threshold met / 3 rounds / owner needed

### Not checked
…
```

---

## When the owner approves

"Approved" is the owner's word. Follow "How the reference moves" in
`docs/QUALITY-BAR.md`. Never self-promote a game you built in the same
session.
