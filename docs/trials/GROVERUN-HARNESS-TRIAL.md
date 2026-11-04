# Trial: GroveRun through the harness-first QC loop

Hand this file to the agent running the trial. It is self-contained.

## What this trial is for

This tests the **pipeline**, not GroveRun. GroveRun is the test case because
we already know some of its bugs, so we can tell whether each layer catches
what it should, and what each layer costs.

The questions it has to answer:

1. Does the free layer (gate 0 + `tools/qa` harness) catch the known problems
   below on its own, with no model involved?
2. Does the small-model critic (`game-critic`) add findings the harness
   can't, and does it avoid inventing ones that aren't there?
3. Do builder rounds converge in at most 3, with every fix proven by numbers?
4. **What does each stage cost?** Tokens or credits, turns and wall time per
   stage. Nobody has measured this yet; it is the main unknown.

## Setup

```bash
git fetch origin
git switch -c claude/groverun-trial origin/claude/qa-harness
git submodule update --init --depth 1
cd tools/qa && npm run setup && npm test && cd ../..
```

Work and push on `claude/groverun-trial` only. Another agent is working on
`Break` on a different branch, so do not push to `claude/qa-harness`.

Read before starting: `AGENTS.md`, `.cursor/skills/game-qc/SKILL.md`,
`.cursor/skills/game-playtest/SKILL.md`, `tools/qa/README.md`.

Machine notes:

- The harness starts its own server on a free port, so a busy 5184 does not
  matter.
- On the owner's machine the in-app browser pane cannot register service
  workers. Trust the harness's headless Chrome for the offline check.

## Procedure

Follow the `game-qc` skill exactly, with the two extra rules below.

1. **Baseline, before touching any code.** Run gate 0, then
   `node tools/qa/run.mjs GroveRun --label trial-r0`. Save the report path,
   and score it against the known-issues table before fixing anything.
2. **Critic round 1 is on the unfixed build**, even if the harness fails.
   This one time it breaks the skill's "harness green first" rule: we need to
   see what the critic says about a build with known problems. Spawn
   `game-critic` (Claude Code: the subagent; Cursor: `.cursor/agents/`) with
   the spawn prompt from the `game-playtest` skill, pointing at `trial-r0`.
   **Do not tell the critic about the known issues.** Pass the pitch, brief
   and run label only. Expect it to write `blocked: harness checks failing`.
   If it does, that is a correct result: record it, then spawn one more critic
   whose prompt also says "Ignore the harness FAILs for this round; judge the
   screenshots anyway." Record both.
3. **Builder rounds (max 3)** per `game-qc` step 4. For each fix:
   - Run `node tools/qa/run.mjs GroveRun --label trial-rN` (and
     `--replay-from trial-r(N-1)` if you changed only drawing).
   - Run `node tools/qa/compare.mjs GroveRun trial-r(N-1) trial-rN`.
   - Put the numbers that moved in the commit message.
   - Spawn a **fresh** critic with the previous label.
4. **Final round**: run `node tools/qa/run.mjs GroveRun --final --label trial-final`,
   then spawn `game-art-director`.
5. Stop at `ready_for_owner` from the art director, or after 3 builder rounds.

Do not tune `qa/expect.json` to make a check pass. If you think a check is
wrong, leave it failing and say why in the notes.

## Known issues (for scoring only — never give these to a critic)

| # | Issue | Where it shows | Expected to be caught by |
|---|---|---|---|
| K1 | The fox is drawn up the road, **ahead** of the bunny (`draw.js` `drawFox`: z grows with `foxGap`) | Pitch says "always behind you" | Harness: `draw:below:fox-player` |
| K2 | The fox gap barely moves: creep and recovery rates almost cancel, so the chase has no pressure | Pitch says "the fox should feel predatory" | Harness: `events:danger`, bot table; critic |
| K3 | Few or no carrots in a typical run (seen at 0 carrots in an earlier manual playtest) | Plan: "carrots every few seconds" | Harness: `first-reward`, `events:reward` |
| K4 | The bunny can be hidden behind obstacles drawn after it | Readability | Critic (R1); maybe `draw:` rules |
| K5 | The earlier critic said "empty playfield". That was **false**: the play view renders fine | — | Nothing should report this. If a layer does, it's a false positive |

The harness has not been run at 20 seeds yet, so K2 and K3 may turn out
smaller or bigger than they look. Record what the harness actually says.

## What to record

Append a new section to `docs/WORKFLOW-TRIAL-NOTES.md` titled
`## Trial 2 — harness-first loop (GroveRun)`, containing:

1. **Cost table**, one row per stage (baseline harness, each critic, each
   builder round, final harness, art director): model, tokens or credits as
   the platform reports them (Claude Code: the subagent's usage in its result
   and the session total; Cursor: the usage dashboard), turns, wall time.
   Write "not reported" rather than estimating.
2. **Catch table**: K1–K5 against gate 0 / harness / critic / art director,
   marked caught, missed or false positive, with the check id or PLAYTEST
   line as evidence.
3. **New findings** nobody listed, and which layer found them.
4. **Harness problems**: crashes, flaky checks, checks that were wrong for
   this game, anything slow (time the 20-seed bot tier).
5. **Skill problems**: places where `game-qc` or `game-playtest` was unclear
   or got skipped, and what you did.
6. **Verdict trail**: round, label, verdict, top reason.

Commit `GroveRun/PLAYTEST.md`, the game fixes (one lever per commit with
numbers), and the trial notes. Do not commit `tools/qa/out/`; it is
git-ignored. Do quote paths into it in the notes.

## Done when

- The trial notes section is filled in, including the cost table.
- `claude/groverun-trial` is pushed.
- The final message names the cheapest and the most expensive stage, says
  whether the harness alone caught K1–K3, and says whether any layer reported
  K5.
