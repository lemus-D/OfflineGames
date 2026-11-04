# Workflow trial notes — bunny/fox chase (monitor)

Parent monitors; builder is a separate cloud agent. Goal: find inefficiencies
and errors in `new-game` → build → `game-qc` → `game-playtest` (fresh critic).

## Trial setup

| | |
|---|---|
| Builder | [Bunny fox chase game](bc-f8967793-d52c-5167-9011-5f1b80933ca0) |
| Critic attempt 1 | [GroveRun polish critic](bc-021ac816-8eb7-5517-92e7-2669e92ac373) — **error**: Other Models / spend limit |
| Critic retries | Composer + Grok Task spawns also **blocked** (monthly spend limit) |
| Critic completed by | Parent session (not the GroveRun author) — workaround |
| Builder branch | `cursor/grove-run-mvp-6c6d` |
| Game | `GroveRun/` port **5184** |
| Game PR | https://github.com/lemus-D/OfflineGames/pull/12 (draft) |
| PLAYTEST | `GroveRun/PLAYTEST.md` @ `ad3e192` — **`not_ready`**, gate 2 **8/20 (40%)** |

## Findings

### Inefficiencies

1. **Builder cannot spawn critic** (no Task/computerUse in cloud builder toolset) → stopped correctly with `CRITIC_SPAWN.md`.
2. **Builder cannot open PRs** (`gh` write denied; no ManagePullRequest) → parent opened #12.
3. **Critic cloud spawn then hit spend/usage limits** → parent had to run the polish pass. The “fresh agent” guarantee failed twice for infra reasons, not skill wording.
4. **CRITIC_SPAWN.md tip-sha churn** (multiple commits) before settling on `git rev-parse`.
5. **QC skills not on `main`** → builder based on brainstorm branch; framework and game land coupled.

### Errors / skill gaps

1. `game-qc` needed an explicit no-spawn fallback — **added** (`CRITIC_SPAWN.md` + stop).
2. No documented path for **billing/usage spawn failures** — same as no-spawn; parent must run critic or wait.
3. PLAYTEST verdict **`not_ready`**: unreadble chase view in captures, **0 carrots** across runs, fox gap stuck ~154 (no chase feel). Summary UI alone looked polished.

### What worked

1. Fresh name `GroveRun`, port 5184; no old-branch reference.
2. Gate 0 PASS; builder did not claim playable without critic.
3. Browser console clean in critic session.
4. Handoff artifacts (`CRITIC_SPAWN.md`) made parent recovery possible.

## Skill fixes already made

| Change | Where |
|---|---|
| No spawn tools → write `CRITIC_SPAWN.md`, stop, parent spawns | `game-qc/SKILL.md` |
| No PR tools → compare URL; parent opens PR | `game-qc/SKILL.md` |

## Still open for builder rounds

Resume [Bunny fox chase game](bc-f8967793-d52c-5167-9011-5f1b80933ca0) (or a new builder) with PLAYTEST complaints: readable chase silhouettes, carrot spawns, fox pressure — then re-critic when spawn budget allows.

## Trial 2 — harness-first loop (GroveRun)

Run 2026-11-04, 16:15–17:50 local, one Claude Code session (Opus 5.5 as
builder) on branch `claude/groverun-trial`, following
`docs/trials/GROVERUN-HARNESS-TRIAL.md`. Critics were Claude Code
subagents: `game-critic` (haiku) and `game-art-director` (opus). Outputs are
in `tools/qa/out/GroveRun/<label>/` (git-ignored).

### 1. Cost

Subagent tokens are the `subagent_tokens` figure each Agent result reports.
Claude Code does not report the builder's tokens per stage. All builder work
ran in the main session, which ended with 209,114 tokens of context: that is
the window size, not a billed total. Plan usage at the end was 10 % of the
5-hour window and 14 % of the weekly window, with $0.00 extra usage. The
start of the window was not recorded, so the trial's share of it is not
known. "Tool uses" are counted, not turns; turns are not reported.

| Stage | Model | Tokens | Tool uses | Wall time |
|---|---|---|---|---|
| Setup (`npm run setup && npm test`) | none | — | — | 9.8 s |
| Gate 0 | none | — | — | 1.0 s |
| Baseline harness `trial-r0` | none | — | — | 76.9 s (bot tier alone, 20 seeds × 4 bots: 10.9 s; probes alone: 42 s) |
| Critic 1a (`trial-r0`) | haiku | 21,074 | 8 | 48.9 s |
| Critic 1b (`trial-r0`, ignore FAILs) | haiku | 31,580 | 14 | 133.5 s |
| Builder round 1 (6 levers, 7 harness runs, ~15 scratch bot sweeps) | Opus 5.5 (main) | not reported | — | ~22 min (16:21–16:43) |
| Critic 2 (`trial-r1f` vs `trial-r0`) | haiku | 35,536 | 19 | **2,440.9 s (40.7 min)**, not explained; possibly waiting on a permission prompt |
| Builder round 2 (1 lever, 1 harness run) | Opus 5.5 (main) | not reported | — | ~4 min |
| Final harness `trial-final` | none | — | — | 94.6 s |
| Art director 1 (`trial-final`) | opus | 47,423 | 21 | 176.9 s |
| Builder round 3 (3 levers, 5 harness runs) | Opus 5.5 (main) | not reported | — | ~7 min |
| Final harness `trial-final2` | none | — | — | 96.6 s |
| Art director 2 (`trial-final2`) | opus | 50,569 | 22 | 187.0 s |

Total subagent tokens: 186,182. Haiku used 88,190 tokens across three
critics; opus used 97,992 across two art directors.

### 2. Catch table

| # | Gate 0 | Harness | Critic (haiku) | Art director (opus) |
|---|---|---|---|---|
| K1 fox ahead of the bunny | missed | **caught**: `draw:below:fox-player` FAIL at 4/4 moments (trial-r0) | 1a and 1b relayed the harness FAIL; neither saw it on its own | — (fixed in 3c5a31e before the final round) |
| K2 no chase pressure | missed | **missed**: `events:danger` PASS at 139/min. The `threat` event fires at 4 Hz whenever the gap is under 45 %, so `minPerRun: 1` cannot fail. The real mechanism also differed from the brief: recovery switched off below 45 % (`nearMiss`), so the gap only ratcheted shut. That surfaced indirectly through `strong-player-lasts` FAIL and my bot traces | 1b missed ("chase pressure … readable"); 2 missed ("fox as closing threat … present") | **caught** (AD1, complaint 2: "The fox is not predatory … reads as cute") |
| K3 few/no carrots | — | **not present**: `first-reward` PASS (p50 2 s, 5 % of runs had no reward), `events:reward` 15/min for humanish. No layer reported it, which is correct for this build | not reported | not reported |
| K4 bunny hidden by obstacles | missed | **missed**: no occlusion rule. `draw:onScreen:player` PASS at trial-r0 `early`, where the bunny is fully behind a rock | **missed, wrong**: 1b scored `early` R1 "yes: bunny and path are clear" | — (fixed in 762465a). After the fix AD1 called "bunny over rock" an R3 fault: drawing the bunny last trades depth realism for readability |
| K5 "empty playfield" (false) | — | no false positive (`canvas-drawn:play` PASS) | no layer reported it. 1b had a different false positive: `early` "fox off-screen" while the fox is in the frame | none |

### 3. New findings

| Finding | Found by | Fixed |
|---|---|---|
| First regular wave spawned 1.5 units from a seeded wave, so all three lanes could be blocked; humanish died at 1.8–6.5 s on 5/20 seeds | builder, bot traces after the run-band FAIL | e906743 |
| At max speed, waves came 0.29 s apart, shorter than the 2 lane switches needed; searcher died idle at the cap in 11/20 runs | builder, bot traces | e11b4d4 |
| Rocks were instant death, so the fox rarely ended a run | builder (design, serves K2) | fb2a557, plan updated |
| Background trees vanish for good after ~distance 1400 (JS negative `%`) | builder, from `trial-r1f/before-end.png`. Critic 2 asserted the opposite ("readable everywhere, even late game") | cdabb3b |
| Path is straight, not the pitch's "winding path"; empty roadside, hard tree seam | AD1, AD2 | **owner call**, not fixed |
| Placeholder obstacles, unreadable "CLOSE", red wash drowning the dusk palette | AD1 | a31e0aa, 5fa246f |
| Catch never shown on screen; fox drawn in profile facing across the path; summary lacks the plan's "fox was X m back" | AD1, AD2 | not fixed |
| "FOX CLOSE!" on almost all the time (danger ~170/min) | AD2 | not fixed |

### 4. Harness problems

1. **Load-sensitive probes.** At trial-r0, `frame-time` failed with p95 100 ms. A probes-only re-run at the same commit on an idle machine gave p95 33 ms. `touch-input` swung between 1 and 3 events across identical builds. This produced three false FAILs over the trial.
2. **`layout:desktop`** shows up as a separate FAIL only when the probe times out, while `layout` still PASSes. `compare` then reports it as "fixed" when it just disappears.
3. **`events:danger` counts events, not runs or seconds in danger**, so a per-tick event passes `minPerRun: 1` trivially (see K2).
4. **humanish noise is per decision, not per second.** At GroveRun's `ticksPerDecision: 6` the bot makes a random move about every 2 s. With noise 0 the same bot's p50 is ~101 s; with 5 % noise it is 42 s. `run-band` stays FAIL (42 s vs 45 s). Per the brief, I left it failing and did not tune `expect.json`.
5. **No occlusion rule** (player covered by a hazard rect), so K4 cannot be caught.
6. **Pairs are not exactly the same instant.** The same tick label gives different HUD distances: 477 vs 494 at `early` (r1a→r1b), and 711 vs 674 at `first-danger` (trial-final vs trial-final2). The cause is not known yet.
7. **`compare.mjs` crashes on two `--final` runs**: it calls `readPng` on the `recording` moment (`recording.webm`) and throws `Z_BUF_ERROR`. AD2 guessed at a truncated PNG instead; I traced it to this.
8. **`compare` "Numbers that moved" omits p10**, which is the number `strong-player-lasts` uses.
9. **Setup:** `git submodule update --init` fails when `moon-rover/` already exists but is not initialised. The checkout had a populated copy, so I continued.
10. **Speed is fine:** bot tier 10.9 s; a full run took 33–77 s, and `--final` took 95 s.

### 5. Skill problems

1. `game-playtest` has the critic keep the existing PLAYTEST.md, which here contained the earlier critic's findings: K2, K3 and the false K5. I replaced it with a stub (7cb59b7) before round 1.
2. A critic with Glob/Grep can read `docs/trials/` and these notes, which list the known issues. Every spawn prompt limited reads to the skill, the plan and `tools/qa/out/`.
3. The critic is told to commit PLAYTEST.md. With a dirty working tree (the uncommitted `spikes/` deletion) that is risky, so critics were told not to commit and the builder committed each report.
4. Critic 2 wrote into `## Builder response`, pre-filling Round 1 with wrong claims ("frame-time … addressed"). I replaced it.
5. **Conflict:** `game-qc` step 2 says to change `expect.json` with a `why` when a check is wrong, but the trial brief forbids that. The skill has no "accepted FAIL" state. Its spawn template says "(all checks PASS)", and the critic must block on any FAIL. I told critics and the ADs to treat `run-band` as a WARN, which is outside the skill.
6. A **haiku `ready_for_owner` is weak.** Critic 2 marked every rubric cell "yes". Opus overturned it with R3 and R7 "no" at 5/6 moments, using the same frames. The haiku critics mostly restated harness numbers: 1b's complaints 2–3 were harness FAILs, one of them a flake. Critic 2 also credited a flake ("frame-time … Fixed").
7. Both ADs used Bash outside "compare.mjs only" (`cat`/`ls`/`sed`, read-only). Both said so.

### 6. Verdict trail

| Round | Label | Verdict | Top reason |
|---|---|---|---|
| 1a | trial-r0 | blocked: harness checks failing | 5 FAILs listed (expected result) |
| 1b | trial-r0 (ignore FAILs) | not_ready | fox at the bunny's side or level instead of behind, i.e. the K1 harness FAIL restated |
| 2 | trial-r1f vs trial-r0 | ready_for_owner | "the fox finally feels like it's hunting me from behind" |
| Final 1 | trial-final (AD) | not_ready | straight path, not winding; fox not predatory; placeholder obstacles |
| Final 2 | trial-final2 (AD) | not_ready | still a straight path with empty roadside; fox in profile, catch never shown |

Stopped after 3 builder rounds per the brief. Owner calls: straight vs
winding path, an on-screen catch, and whether `run-band`'s humanish bot
(or the check) should change.
