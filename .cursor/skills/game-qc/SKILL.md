---
name: game-qc
description: Quality control for a game in this repo before it is called done. Runs the mechanical gates, plays the game in a browser against docs/QUALITY-BAR.md, measures the fun proxies, and runs a feel pass in the moon-rover style (complaint list, one lever at a time, before/after numbers). Use before opening or updating a PR that claims a game or change is playable, and when the user asks whether a game is good, finished, or ready.
---

# Game QC

The bar is `docs/QUALITY-BAR.md`. This skill is the procedure that applies
it. Read the bar first; it is short and it is what the scores mean.

The output of this skill is a **QC report** in the PR body (template at the
end). Every line in it is something you observed. If you did not observe it,
the line says "not checked", not a guess.

## Gate 0 — Honest (mechanical, pass/fail)

```bash
node .cursor/skills/game-qc/scripts/check-game.mjs <Game>
```

Fix every `FAIL` before going further. Warnings are judgement calls; say in
the report which ones you left and why.

Then read `<Game>/smoke.mjs` and ask whether it would catch a broken game.
If it only scans for `Math.random`, extend it until it drives `PlaySession`
and asserts determinism, idle-loses, scripted-progress and run-ends. The
smoke is the game's own statement of what it does; make it say something.

## Gate 1 — A game (observed, pass/fail)

Start the server in a tmux session so it outlives the command:

```bash
SESSION_NAME="<game>-dev"
tmux -f /exec-daemon/tmux.portal.conf new-session -d -s "$SESSION_NAME" -c "$PWD/<Game>" -- npm start
```

Use the `Playwright` tools against `http://localhost:<port>`. Work through
the gate-1 list in the bar, in this order, capturing as you go:

1. **Console.** Attach to console messages before loading. Load, click
   start, play 20 s, die, restart. Zero errors. Paste anything else into the
   report.
2. **Loop.** Did start → play → end → summary → play-again happen without a
   reload? Screenshot the summary.
3. **Keyboard.** Play a run with keys only. Screenshot mid-run.
4. **Touch.** Set the viewport to 390 × 844, emulate touch, play a run with
   taps and drags only. Screenshot. If the game cannot be played this way,
   gate 1 fails — stop and fix input before anything else.
5. **Fit.** Screenshots at 390 × 844 and 844 × 390. Estimate HUD coverage;
   anything essential hidden or under a thumb fails.
6. **Persistence.** Note the best score, reload, confirm it survived. Then
   set `localStorage['<game>.v1.profile'] = 'garbage'` and reload; it must
   boot with a fresh profile, not a blank screen.
7. **Offline.** Load twice, kill the server (`tmux kill-session`), reload.
   The game must boot. Restart the server after.
8. **Frame time.** Throttle CPU 4× in Playwright/CDP, play 20 s, read
   `performance.now()` deltas or a frame counter. Note the result; the sim
   must not visibly speed up or slow down.

Record a 30–60 s run with the screen recorder while doing step 3 or 4. That
recording is the headline artifact of the report.

## Gate 2 — Fun (scored, evidence required)

Score F1–F10 from the bar. For each, perform the **test** written under it
and quote the **evidence** in the report. Rules:

- A criterion with no quoted observation scores **0**, whatever you believe.
- Do not round up. If you are between 1 and 2, it is a 1 and the report says
  what would make it a 2.
- Collect the measurable proxies with a headless bot. If the game has no bot
  harness yet, add one to `smoke.mjs` (or a sibling `feel.mjs`): a scripted
  player over 20 seeds that logs run length, time to first reward, time to
  first danger, and the idle run length. Put the median and p10–p90 in the
  report. This is the one piece of new code QC is allowed to add.

MVP "done" is 14/20 with no zero. Below that, go to the feel pass. At or
above it, still do one feel pass — it is cheap and it is where the quality
comes from — then write the report.

## The feel pass

`moon-rover` got good through sixteen rounds of "this bit is wrong, fix it".
A feel pass is one of those rounds, run by the agent before the owner has to.

1. **Play three runs** (Playwright, touch viewport for at least one). Do not
   read code while playing.
2. **Write the complaint list** — ten items, in the player's voice, ranked by
   how much each one would make you stop playing. Complaints, not features:
   "I died and did not see what hit me", "the restart button is under my
   thumb", "eating makes no sound", not "could add particles". Put the list
   in the report.
3. **For the top three**, find the lever. Prefer a constant in `content.js`;
   a code change is a second choice. Write down the before value and the
   proxy it should move (F-number and metric).
4. **Change one lever.** Re-run smoke and the bot. Play one run. Did the
   number move the way you said, and does the complaint go away?
5. **Commit per lever**, with before → after in the message:
   `Apex: hitbox 0.92 → 0.80 of drawn radius; bot p10 run 18 s → 31 s`.
6. Repeat for the next complaint. **Stop** when the remaining complaints are
   about content ("more enemy types") rather than feel, or after five
   levers — then re-score gate 2 and write the report.

Things that are usually the top complaint, in this repo's history: no
sound on actions; a death with no visible cause; restart more than one tap;
touch control covering the player; a fuel or hunger meter that drains so
fast the opening has no grace window.

## When the owner approves

"Approved" is the owner's word, not yours. If the owner says it, follow
"How the reference moves" at the end of `docs/QUALITY-BAR.md`: one commit,
`Reference: <Game> approved`, touching the bar, `AGENTS.md`, the `new-game`
scaffold source, and any check the game taught us. Never promote a game you
built in the same session unless told to.

## QC report template

Paste into the PR body. Keep the headings; fill the lines with observations.

```markdown
## QC report — <Game> @ <short sha>

### Gate 0 — Honest
check-game: PASS / FAIL (n warnings: …)
smoke: PASS (asserts: determinism, idle-loses, progress, run-ends)

### Gate 1 — A game
Console: 0 errors across load/start/die/restart
Loop closes without reload: yes — <screenshot>
Keyboard: yes — <screenshot>
Touch 390×844: yes / NO — <screenshot>
Fit 390×844 / 844×390: HUD ≈ __ % / __ % — <screenshots>
Persistence: best survives reload; garbage profile → fresh boot
Offline after server kill: boots / does not
Frame time @4× CPU: __ ms median; sim speed unchanged
Recording: <link>

### Gate 2 — Fun  (__/20)
F1 verb: _ — "<observation>"
F2 readable: _ — "<observation>"
F3 feedback: _ — <events: n, with visual: n, with audio: n>
F4 fair deaths: _ — hitbox __ of drawn; 5 deaths: <sentences>
F5 tension: _ — bot median __ s (p10 __, p90 __); first reward __ s; first danger __ s
F6 one more go: _ — restart __ tap(s); summary names near-miss: yes/no
F7 controls: _ — input→visible __ frame(s); thumb covers: <what>
F8 look: _ — <10 s and game-over screenshots>
F9 sound: _ — __ distinct sounds mapped to <events>
F10 depth: _ — __/__ content rows change behaviour

### Feel pass
Complaints (ranked): 1. … 2. … 3. … (up to 10)
Levers pulled: <constant> __ → __ ; <proxy> __ → __ (commit <sha>) …
Stopped because: <remaining complaints are content> / <five levers>

### Not checked
<anything above you could not observe, and why>
```
