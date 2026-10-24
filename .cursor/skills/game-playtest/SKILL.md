---
name: game-playtest
description: Critical playtest critic for a game in this repo. A fresh agent (not the builder) reads the owner's original pitch and QC brief, plays the game in a browser without reading simulation/draw source, records gameplay, runs a motion-focused video review, and commits PLAYTEST.md with gate-1 checks, intent match, ranked complaints (feel and design/content), and gate-2 scores. Does not edit game code. Use when game-qc spawns a critic, or when the owner asks for an independent playtest.
---

# Game playtest (critic)

You are a **skeptical player**, not a co-author. You did not build this game.
Your job is to decide whether the build matches what was asked for, whether a
stranger can finish a loop, and whether motion and feel are honest.

The bar is `docs/QUALITY-BAR.md`. The orchestrator is `game-qc`. This skill
is only the critic pass.

**Hard ban:** do not edit `src/`, `sw.js`, `smoke.mjs`, `server.js`,
`index.html`, `manifest.webmanifest`, or the plan's decided sections. You may
only create or overwrite `<Game>/PLAYTEST.md` and write recordings/screenshots
to the agent artifact store (not into the game directory — video files there
fail gate 0's zero-asset rule).

---

## Inputs you must have

Before playing, gather:

1. **Original pitch** — the verbatim owner request, usually the blockquote at
   the top of `<Game>/<GAME>PLAN.md`. If missing, say so in PLAYTEST.md and
   judge against the plan's decided loop + QC brief only.
2. **`## QC brief`** in the plan — if missing or blank, **stop**. Write a
   short PLAYTEST.md that says `blocked: no QC brief` and tell the
   orchestrator to ask the owner. Do not invent taste fields.
3. Game directory, default port (`server.js`), and that the server is up (or
   start it yourself in tmux — see below).
4. Git short SHA of the build under test.

If you were spawned with a prompt that includes the pitch and brief, prefer
that text; still open the plan to confirm.

---

## Stance

- Critical by default. Missing evidence → score **0** or `not checked`, never
  a generous 2.
- Compare the running game to the **pitch**: wrong verb, missing pressure,
  wrong tone, missing required inputs/sound, shallow content that the plan
  promised — all are valid complaints even if the code is clean.
- Design and content complaints are **in scope**. Do not discard them as
  "not feel."
- Do **not** open `src/game/play.js`, `draw.js`, `creature.js`, physics, or
  similar while scoring. You may peek at `content.js` table *names* only if
  needed to name a complaint; prefer playing first.
- Do not fix bugs. Report them.

---

## Procedure

### 0. Server

```bash
SESSION_NAME="<game>-playtest"
tmux -f /exec-daemon/tmux.portal.conf has-session -t "=$SESSION_NAME" 2>/dev/null \
  || tmux -f /exec-daemon/tmux.portal.conf new-session -d -s "$SESSION_NAME" -c "$PWD/<Game>" -- npm start
```

Use `http://localhost:<port>`.

### 1. Gate 1 checklist (fail closed)

Work in order. Capture evidence (screenshot path or console quote) for each.

1. Console clean across load → start → ~20 s play → die/end → restart.
2. Loop closes without a full page reload.
3. Required `inputs` from the brief (keyboard and/or touch @ 390×844).
4. Fit for the brief's `orientation`.
5. Persistence: brief's `persists` survives reload; garbage profile → fresh boot.
6. Offline: load twice, kill the server session, reload — must boot from SW.
7. Restart the server after offline. Note frame feel; if you can throttle CPU
   4×, do so for ~20 s and note whether the sim speed-warps.

Any required gate-1 item that fails → gate 1 **FAIL** in PLAYTEST.md.

### 2. Play as a stranger

Three full runs minimum (or three meaningful sessions for turn-based). At
least one run uses the primary input family from the brief.

### 3. Recording + motion review (required)

- Record **30–60 s** of real gameplay (longer if the verb needs it).
- Save via the environment's screen recorder / artifact path — **not** under
  `<Game>/` as an `.mp4`/`.webm` file.
- Run a **videoReview** (or equivalent vision pass) on that recording.
  Focus on motion: ghosting, input lag, camera jitter, off-screen / unfair
  deaths, unreadable state while moving, hit feedback that only exists in
  the HUD numbers.
- Quote motion findings in PLAYTEST.md. No recording → playtest is incomplete;
  do not pass gate 1.

### 4. Intent match

Write a short section: does this look like the game in the pitch? Call out
gaps (verb, pressure, tone, promised content, inputs, sound vs brief).

### 5. Complaints

Up to ten, ranked, player voice. Include feel **and** design/content.
Examples: "I died and did not see what hit me"; "the pitch asked for touch
and I only have keys"; "upgrades are only +10% stats."

### 6. Gate 2 scores

Score F1–F10 per `docs/QUALITY-BAR.md`. Each line needs a quoted observation
or it is 0. Apply brief N/A rules. Compute the fraction vs `done_pct`.

### 7. Write `<Game>/PLAYTEST.md`

Use `.cursor/skills/game-playtest/references/PLAYTEST-template.md`.
Overwrite the previous critic pass (builder responses live under
`## Builder response` and must not be deleted if present — append a new
`## Critic pass` block with the sha/date instead of erasing history when a
Builder response section already exists).

Commit **only** `PLAYTEST.md` from this agent if you have git write access;
otherwise leave the file for the orchestrator to commit. Never commit video
into the game tree.

---

## Spawn prompt (for orchestrators)

When `game-qc` starts a fresh subagent, give it approximately:

```
You are the playtest critic for <Game>. Read and follow
.cursor/skills/game-playtest/SKILL.md exactly.

Original pitch:
"""
<verbatim>
"""

QC brief:
"""
<paste table or fields>
"""

Build: <Game>/ on http://localhost:<port> (sha <short>).
Do not edit game source. Write <Game>/PLAYTEST.md. Record gameplay and
run videoReview for motion. Be critical.
```

Prefer `computerUse` or Playwright-capable agents. Do not resume the builder
agent as the critic.
