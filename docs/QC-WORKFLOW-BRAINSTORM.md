# QC workflow brainstorm — playtest agents and harder gates

> Branch: `cursor/qc-playtest-brainstorm-6c6d`
> Status: **superseded in part by `tools/qa`** (2026-10-27). Bots and browser
> probes now do the measuring for free; the critic judges taste from the
> harness report. #3 reopened, #7 narrowed — see the table. CI (#4) deferred.

Why this exists: gate 0 (`check-game.mjs` + smoke) is honest about the house
rules, but “playable / fun / done” still depends on the *same* coding agent
reading a long procedure, half-doing browser steps, and scoring its own work.
That is the weak joint. This note proposes a sharper workflow.

---

## Owner decisions (2026-10-23)

| # | Topic | Decision | Notes |
|---|---|---|---|
| 1 | Critic | **Fresh agent, critical** | Sees the **original pitch/prompt** + plan/brief; judges the build against that intent, not against the builder’s excuses. Stance: skeptical player, not co-author. |
| 2 | Report location | **Commit** `PLAYTEST.md` | Keep out of SW precache. Videos may still live in artifact store; checklist + complaints + scores in git. |
| 3 | Smoke hardening → **bot tier** | **Reopened 2026-10-27: bot tier** | Not one arcade smoke contract: a per-game `qa/adapter.mjs` and genre profiles (`arcade`, `turn`) in `tools/qa`. Bots measure; the critic judges taste. Smoke stays per-game. |
| 4 | CI for gate 0 | **Deferred** | Owner: ignore for now. Revisit after the critic loop works. |
| 5 | Critic rounds | **3** | Design **and** content complaints are **in scope** — do not stop / ignore them as “not feel.” Escalate to owner only when a change needs a taste call the brief does not cover. |
| 6 | Trial game | **Owner will pitch a new game** | Do not trial on Apex/Sharky/UnfairPickle first. New title exercises `new-game` → build → critic end-to-end. |
| 7 | Recording / motion | **Final round only** (2026-10-27) | Saves credits. `run.mjs --final` records `recording.webm` for the owner and a 16-frame filmstrip the art director reviews for motion. Earlier rounds use key-moment screenshots; ghosting and frame time are probes every round. |

### Implications for the playtest agent (from #1, #5, #7)

The critic is not “run the gate-1 checklist and leave.” It is closer to:

1. Read the **original user pitch** (verbatim in the plan), the QC brief, and
   non-goals.
2. Play without reading `play.js` / `draw.js`.
3. Ask: *did we get the game that was asked for?* Verb, pressure, tone,
   inputs, run shape — gaps are complaints even if the code is “correct.”
4. Record 30–60 s (longer if needed); run a **motion-focused** review on the
   video (ghosting, input lag, off-screen deaths, unreadable state in motion).
5. Rank complaints across feel **and** design/content (missing audio that the
   brief required, wrong verb, shallow upgrades, etc.).
6. Stay critical: missing evidence → fail or `not checked`, never benefit of
   the doubt for the builder.

Builder then gets up to **3** rounds to respond (including content/design
fixes that fit the brief). Re-playtest + re-record after material changes.
Owner is pinged when the critic and builder disagree on intent, or when the
fix would expand `non_goals`.

---

## What’s wrong with the current QC (observed)

| Gap | What happens today | Why it hurts |
|---|---|---|
| Builder grades itself | `game-qc` is run by the agent that just wrote the game | Soft scores, skipped feel pass, invented observations |
| Gate 1/2 are prose only | Playwright steps live in `.cursor/skills/game-qc/SKILL.md` with no harness | Agents skip offline kill, touch, 4× CPU, recordings |
| Smoke ≠ fun proxies | Smoke asserts “something works”; bar asks for 20-seed medians | F5 can be claimed without numbers |
| No QC brief on most games | Plans predate the brief; skill says “ask then stop” | Agents either stop or guess and keep going |
| No artifact contract | Screenshots/recordings are “should” | PRs claim playable with no evidence in-repo |
| One agent does three jobs | Build → play → tune → re-score | Context pollution; the feel pass becomes a code-edit session |
| No CI | Green is whoever remembered to run smoke | Broken main possible between agent sessions |

Gate 0 itself is fine. Keep it. Harden what surrounds it.

---

## Why this is failing (before we build anything)

The quality framework assumed agents would *execute* a long procedure. Repo
history shows they execute the cheap, automatable part and treat the rest as
optional narrative. That is the failure mode to design against — not “we need
a smarter model.”

### Evidence already in this repo

**1. No merged game PR contains a QC report.**

PRs #3 (Sharky), #4 (Yes-General), #5 (Apex), #8 (Apex hazards) all claim
playable / MVP / ready enough to merge. None paste the gate-0 / gate-1 /
gate-2 template from `game-qc/SKILL.md`. PR #9 *added* that template; every
game merge either predates it or ignored it (#8 merged after #9 and still
has no QC report). Drafts #6, #7, #10 also lack one.

So the skill is not binding. Agents and merge decisions treat “smoke green +
a screenshot” as done.

**2. The bar already lists the failures — and they still shipped.**

`docs/QUALITY-BAR.md` “Known weak spots” names: silent games, keyboard-only
Apex, port collision (Break/RabbitRun both 5183), hint-text-only onboarding,
summary screens without near-misses. Those are exactly F7 / F9 / F6 misses.
The framework documented the disease after the patient left the hospital; it
did not become a gate that blocked the next PR.

**3. Gate 0 and “fun” were built for different audiences.**

`check-game.mjs` answers: *did we lie about the house rules?* Smoke answers:
*does the sim still step?* Neither answers: *would a stranger play a second
run?* An agent optimizing for green checkmarks will stop at gate 0 because
that is the only fail-closed step. Everything after is fail-open prose.

**4. Self-grading is structurally soft.**

The builder knows the intended verb, the hitboxes, the spawn grace it just
wrote. When `game-qc` says “play five runs and write deaths in the player’s
voice,” the builder already believes deaths are fair. A fresh agent that only
sees the canvas does not. Without separation, the feel pass collapses into
“tweak a constant I already like.”

**5. Cost asymmetry.**

| Step | Cost to agent | Cost of skipping |
|---|---|---|
| `check-game.mjs` | seconds, exits 1 | high — skill + PR say FAIL |
| `npm run smoke` | seconds | medium — often run |
| Playwright loop + offline kill | minutes, flaky setup | low — nobody fails the PR |
| 20-seed feel bot | needs new code first | low — bar allows “add feel.mjs” then forget |
| Honest F1–F10 with quotes | judgment + artifacts | low — scores can be invented |

Agents follow cost. Fail-open steps get skipped. Any new step we add that is
not fail-closed will fail the same way.

**6. The brief is a gate that nobody trips.**

`game-qc` says: if `## QC brief` is missing, run gate 0, ask the owner, stop.
On `main`, Sharky / Apex / Yes-General still have no brief. Either agents are
not running `game-qc` at all, or they skip the stop. Adding more procedure
without a hard stop condition will not change that.

### Failure modes for a playtest agent (so we don’t romanticize it)

A second agent is not magic. It can still fail if we are sloppy:

| Failure | What it looks like | Design counter |
|---|---|---|
| Critic that can edit | “fixes” while playing; report vanishes into a refactor | Playtest skill: **no source edits** |
| Critic that reads `play.js` | grades intent, not feel | Skill: do not open sim/draw while scoring |
| Critic with no brief | invents `run_band` / sound expectations | Orchestrator refuses spawn until brief exists |
| Critic without artifacts | prose complaints, unverifiable | Require screenshots + checklist boxes |
| Infinite polish loop | builder↔critic ping-pong for days | Max rounds, then escalate to owner |
| Builder rewrites scores | “F4 was unfair, now it’s a 2” without re-play | Append-only PLAYTEST; re-spawn for new scores |
| Spawn flaky / expensive | team falls back to no critic | Keep artifact contract (B) even when spawn fails |
| Headless bot never added | F5 still vibes | Checker **fails** arcade games without proxy harness |

If we ship a playtest skill that is only markdown, we will recreate today’s
problem with a longer name.

---

## Design goal

An agent (or a human) cannot call a game **done** unless:

1. **Gate 0** is green (already automated).
2. A **separate playtest pass** produces a machine-readable complaint report
   plus artifacts (screenshots / short recording).
3. **Measurable proxies** (run length, first reward, first danger, idle death)
   are collected by a headless bot, not estimated.
4. The builder may fix levers from the report, but **may not rewrite the
   playtest scores**. Re-playtest is required after changes.
5. The owner still owns taste (QC brief) and final “approved.”

That is the moon-rover loop (“this bit is wrong, fix it”) with a critic that
did not write the code.

---

## Proposal A — Split `game-qc` into three skills (recommended shape)

```
new-game  →  (build)  →  game-qc (orchestrator)
                              │
                              ├─ gate 0: check-game.mjs + smoke   [same agent OK]
                              ├─ playtest agent (NEW)             [fresh context]
                              │     → PLAYTEST.md + artifacts
                              ├─ feel bot: feel.mjs / smoke bot   [headless]
                              └─ builder feel pass                [same or next agent]
                                    reads PLAYTEST.md, one lever at a time
```

### A1. `game-playtest` skill (new)

**Job:** play the game as a stranger. Do not read `play.js` / `draw.js` while
scoring. Do not edit game code. Output only a report and artifacts.

**Who runs it:** a *fresh* agent — preferably a Cursor `computerUse` (or
Playwright) subagent spawned by the builder/orchestrator, with **no prior
build context**. Prompt includes: the **original pitch** (from the plan),
QC brief, game dir, port, URL, and “you are not allowed to modify source;
be critical; compare the build to the pitch.”

**Hard rules for the playtest agent:**

- May start/stop the game’s `npm start` server.
- May use browser / Playwright / screen recorder + videoReview.
- May write committed `<Game>/PLAYTEST.md` and reference recording paths.
- Must not edit `src/`, `sw.js`, plans, or smoke.
- Must not invent gate-2 scores without performing the written test for
  that criterion. Missing evidence → score 0 or `not checked`.
- Must judge **intent match** (pitch + brief), not only mechanical boots.

**Minimum playtest protocol (gate 1 + intent + motion):**

1. Boot, console clean across load → start → 20 s play → die → restart.
2. Required input family from the brief (keyboard and/or touch @ 390×844).
3. Full loop without reload; screenshot summary.
4. Persistence: value survives reload; garbage profile → fresh boot.
5. Offline: second load, kill server, reload (same probe as
   `docs/PLATFORM-CONSTRAINTS.md`).
6. Three full runs “as a player.”
7. **Required** 30–60 s recording; vision/`videoReview` pass focused on
   motion (lag, ghosting, unfair deaths, unreadable state while moving).
8. Ranked complaint list (feel **and** design/content vs pitch/brief).

**Output schema** (sketch — lock before implementing):

```markdown
# Playtest — <Game> @ <sha>
Brief: shape=… run_band=… inputs=… …
Server: http://localhost:<port>
Tester: playtest-agent (no source edits)

## Gate 1 checklist
- [ ] console clean — evidence: …
- [ ] loop closes — screenshot: …
- [ ] keyboard / touch — …
- [ ] fit / HUD — …
- [ ] persistence — …
- [ ] offline after kill — …
- [ ] frame feel @4× — …

## Complaints (ranked)
1. …
2. …

## Gate 2 scores (only if brief present)
F1: _ — "…"
…

## Artifacts
- recording: …
- screenshots: …
```

### A2. `game-qc` becomes the orchestrator

Keep the name. Change the procedure:

1. Read / demand QC brief (unchanged).
2. Run gate 0 locally.
3. **Spawn playtest agent** (do not play yourself if a subagent is available).
4. Run or require `feel.mjs` / bot proxies.
5. If gate 1 failed or complaints top-3 are feel bugs → builder feel pass
   (one lever, before/after, commit), then **re-spawn playtest**.
6. Paste playtest report + bot numbers into the PR. Builder may add a short
   “levers pulled” section; may not alter playtest scores.

### A3. Headless `feel.mjs` (or smoke extension) — not optional for arcade

For `shape: real-time arcade`, gate 2 F5 is inadmissible without a bot over
≥20 seeds logging:

| Metric | Source of truth |
|---|---|
| idle run length | bot, no input |
| median / p10 / p90 run length | scripted player |
| time to first reward | first coin / eat / etc. |
| time to first danger | first hazard contact or near-miss |

`check-game.mjs` should **fail** (not warn) if an arcade game’s smoke/feel
harness does not import the simulation and assert determinism + idle-loses +
progress. Turn-based games keep a softer rule (match smoke is enough).

---

## Proposal B — Playtest as a required PR artifact, even without a subagent

If spawning a second agent is flaky or expensive, still require:

- A `PLAYTEST.md` committed or attached to the PR.
- At least one recording or three screenshots covering menu, mid-run, summary.
- Bot proxy table filled with numbers next to `run_band`.

The **same** agent may write it, but the skill must refuse “playable” claims
when the file is missing or when any gate-1 box is unchecked. Weaker than A
(self-grading remains), stronger than today (evidence is mandatory).

**Recommendation:** ship B as the contract immediately; ship A (fresh agent)
as soon as the orchestrator can spawn `computerUse` / Playwright reliably.

---

## Proposal C — Harder mechanical floor (cheap wins)

Independent of playtest agents; do these in a follow-up PR:

1. **Smoke contract** — `check-game.mjs` fails arcade games unless smoke
   asserts: same seed → same state; idle dies within 30 s; scripted progress;
   run ends with a summary object.
2. **QC brief presence** — warn today, fail after a cutoff date, or fail for
   any game that claims “done” / “playable” in the PR title.
3. **Port registry** — single table in `AGENTS.md` (already) plus checker;
   next free port documented; reject collisions (already does when both dirs
   exist).
4. **CI on PRs** — `node .cursor/skills/game-qc/scripts/check-game.mjs <Game>`
   for every game directory touched by the PR. No browser CI yet.
5. **Audio / touch warnings → brief-aware fails** — if brief says
   `sound: minimal` and there is no `audio.js`, fail; if `inputs: both` and
   input module has no pointer handlers, fail (static scan, imperfect but
   useful).

---

## Proposal D — Closed builder ↔ critic loop

```
Builder agent                     Playtest agent
     │                                  │
     │  push branch + start server       │
     │─────────────────────────────────►│
     │                                  │ write PLAYTEST.md
     │◄─────────────────────────────────│
     │  fix top complaint (1 lever)     │
     │  bump sw cache, smoke green      │
     │─────────────────────────────────►│
     │                                  │ re-play; close or escalate
     │  stop after N rounds or owner    │
```

Defaults to propose:

| Knob | Default | Notes |
|---|---|---|
| Max critic rounds before asking owner | 3 | Owner-locked |
| Max levers / fixes per round | several OK if one theme | Prefer one lever for feel; content fixes may be larger |
| Playtest may edit code | **no** | Critic stays clean |
| Builder may edit PLAYTEST.md scores | **no** | Append only “Response” section |
| Design/content complaints | **in scope** | Do not discard as “not feel”; fix or ask owner if outside brief |
| When to stop | gate 1 pass AND gate 2 ≥ `done_pct` AND critic’s top issues addressed or owner ruled | Or 3 rounds exhausted |
| Recording | **required each playtest** | Motion review on the video each round |

---

## Proposal E — What we should *not* do

- **Don’t** put a LLM “fun score” with no protocol. The bar already has tests;
  the failure is execution, not missing vibes.
- **Don’t** share a runtime engine package to make testing easier (D7).
  Copy `feel.mjs` patterns like we copy `rng.js`.
- **Don’t** auto-promote a reference game from playtest scores.
- **Don’t** require human play for every commit — only for “approved” and
  maybe for first MVP merge of a new title.
- **Don’t** skip recording because screenshots exist. Owner-locked: motion
  review on video is required. Screenshots alone are not enough for F4/F7.

---

## Concrete file changes (when we leave brainstorm)

| Path | Change |
|---|---|
| `.cursor/skills/game-playtest/SKILL.md` | New skill: protocol + output schema + “no edits” |
| `.cursor/skills/game-qc/SKILL.md` | Orchestrate: gate 0 → spawn playtest → bot → feel pass → re-playtest |
| `.cursor/skills/game-qc/scripts/check-game.mjs` | Stricter smoke contract; brief-aware audio/touch fails |
| `.cursor/skills/game-qc/scripts/run-playtest-prompt.mjs` | Optional: print the exact prompt to paste/spawn |
| `docs/QUALITY-BAR.md` | Require PLAYTEST.md + bot table for “done”; note critic separation |
| `AGENTS.md` | Third workflow: playtest; update “two workflows” → three |
| `<Game>/feel.mjs` (per game, starting with Apex) | 20-seed proxy harness |
| `.github/workflows/gate0.yml` (optional) | Run check-game on changed games |

Trial game is **not** UnfairPickle/Apex — owner will bring a new pitch so
`new-game` → build → critic runs cold.

---

## Deferred: #3 and #4

### #3 Smoke — leave alone (locked)

Do not harden `check-game.mjs` around an arcade-only smoke contract.
Yes-General is turn-based; idle-loses / FIXED_DT proxies do not apply the
same way. Per-game smoke stays as each game writes it. Gate 0 still runs
whatever smoke exists and requires exit 0.

Quality for “is this the game we asked for / does motion feel right” is the
playtest critic + recording, not smoke.

### #4 CI — deferred

No GitHub Action for now. Revisit after the critic loop works.

---

## Decisions — full elaboration (historical)

Locked answers are in [Owner decisions](#owner-decisions-2026-10-23).
The sections below remain as tradeoff notes.

### 1. Critic separation — A (fresh agent) vs B (same agent + artifacts) vs both

**What is actually broken:** self-grading and skippable steps. A fixes
self-grading. B fixes skippable steps. Neither alone fixes both.

| Option | Fixes | Leaves broken | Cost |
|---|---|---|---|
| **A only** — must spawn a fresh playtest agent | Bias / “I know the hitboxes” | If spawn is flaky, QC collapses to nothing | Higher per PR (second agent) |
| **B only** — builder fills `PLAYTEST.md` with required artifacts | “smoke green ⇒ playable” without evidence | Builder still soft-scores F1–F10 | Lower; same agent |
| **Both (B contract, A when spawn works)** | Evidence always; bias when we can afford it | Slightly more process to document | Medium |

**Why “both” is the default:** history shows agents skip prose. A mandatory
artifact file is fail-closed (“no PLAYTEST.md ⇒ not done”) even when the
orchestrator cannot spawn `computerUse`. The fresh agent is the quality
upgrade on top of that contract, not a substitute for it.

**Risk if we only build A:** first time spawn fails in cloud, the builder
“playtests itself” again and we are back here.

**Risk if we only build B:** we get prettier self-grades with screenshots —
still the author grading the homework.

**Owner (2026-10-23):** fresh critical agent that sees the original prompt —
closer to A, with pitch-in-context (not only “both”). Artifact file still
committed (#2).

---

### 2. Where does `PLAYTEST.md` live — committed vs artifact store only

**What is actually broken:** the next agent (or you) cannot see what the
last critic said. PR bodies and Cursor artifact URLs rot; they are not in
the tree the next session reads.

| Option | Pros | Cons |
|---|---|---|
| **Commit `<Game>/PLAYTEST.md`** | Next builder/playtest reads it; diff shows score churn; works offline | Noise in git; must keep it out of `sw.js` PRECACHE; stale if forgotten after a big rewrite |
| **Agent/PR artifacts only** | Clean tree; large videos stay out of git | Next cloud agent often cannot see prior artifacts; no in-repo audit trail |
| **Hybrid** — short `PLAYTEST.md` in git + videos in artifact store | Best of both | Two places to look |

**Why commit the report (default):** skills and agents are file-driven. If
the critic’s output is not a file in the worktree, the builder feel-pass
will not reliably find it. Videos can stay in the artifact store; the
markdown checklist and complaint list should be local.

**Must decide with this:** `PLAYTEST.md` is **not a shipped game file**.
`check-game.mjs` should ignore it (and must not require it in PRECACHE).
Otherwise every QC run forces a pointless SW cache bump.

**Owner (2026-10-23):** **commit** the report.

---

### 3. Smoke hardening — fail arcade games missing determinism + idle-loses + progress

**What is actually broken:** smoke today means “agent wrote some asserts.”
Sharky’s smoke proves a scripted chase can eat; it does **not** prove same
seed ⇒ same state, or that idle eventually dies. The bar’s F5 proxies assume
those properties. Agents will not add them unless the checker fails.

| Option | Effect |
|---|---|
| **Keep warn** (`asserts < 8`) | Status quo — weak smokes stay green |
| **Fail if missing four properties** (determinism, idle-loses, progress, run-ends) | Forces Apex/Sharky (and new arcade games) to grow real harnesses |
| **Separate `feel.mjs` required by name** | Clearer separation: smoke = correctness, feel = proxies; more files |

**Tension:** hardening smoke will temporarily make existing games fail gate 0
until someone upgrades them. That is the point — but it blocks unrelated
PRs if CI runs on all games.

**Mitigation if we say yes:** phase it — warn for one PR cycle, then fail;
or fail only when the PR touches that game’s `src/`.

**Owner (2026-10-23):** **leave alone** — mixed genres; no one-size smoke contract.

---

### 4. CI — GitHub Action for gate 0 on PRs

**What is actually broken:** green is whoever remembered. Parallel agents
already shipped a port collision because nothing ran `check-game` across
the whole tree on merge.

| Option | Fixes | Does not fix |
|---|---|---|
| **No CI** | — | Same as today |
| **Gate 0 on games touched by the PR** | Broken syntax / Math.random / precache / port clash on that PR | Fun, browser, other games drifting |
| **Gate 0 on every game every PR** | Cross-game port uniqueness always | Slower; unrelated failures block you |

**Why “touched games only” is the default:** cheap, matches how agents work
(one game per branch), and still catches the Break/RabbitRun class of bug
*if* both dirs are in the PR. Cross-tree port check already looks at every
`server.js` when you run the script on one game — so a RabbitRun-only PR
still fails if 5183 is taken by Break on the same branch checkout.

**CI will not run Playwright.** That is fine. CI’s job is fail-closed
mechanics; playtest stays in the agent loop.

**Owner (2026-10-23):** undecided — see [Still open](#still-open-3-and-4).

---

### 5. Max critic rounds before pinging you

**What is actually broken:** without a cap, builder↔critic can burn a whole
session polishing F8 while F1 is still a 1 — or loop forever on taste.

| Cap | Meaning |
|---|---|
| **1** | One playtest, one feel pass, then you decide — cheap, may under-polish |
| **3** | Matches “top three complaints” × roughly one round each |
| **5** | Current feel-pass lever cap; expensive; risk of chasing content complaints |

**Stop conditions matter more than the number:** stop early if gate 1 fails
in a way that needs a design change (not a constant), or if remaining
complaints are content (“more enemy types”). Escalate to you with the
complaint list rather than inventing scope.

**Owner (2026-10-23):** **3**, and design/content complaints stay in scope.

---

### 6. First game to trial the new loop

We should learn whether the *workflow* works, not whether a game is fun.
Pick the trial for what it teaches.

| Game | Why trial it | Why not first |
|---|---|---|
| **Apex** | Scaffold reference; on `main`; richest smoke; no brief yet → tests “ask brief then stop” | Silent + keyboard-only; playtest will correctly complain about known gaps |
| **Sharky** | Has audio + touch; hardest honest playtest | Heavier; weak smoke; no brief |
| **UnfairPickle** (draft branch) | **Only game with a filled QC brief**; already claims gate 0 | Not on `main`; platformer shape stresses different bot proxies |
| **Break / Rabbit Run** | Draft MVPs | Port collision + incomplete vs bar; noisy first trial |

**Recommendation to discuss:** trial on **UnfairPickle** if the goal is
“does brief → playtest → report work end-to-end,” or **Apex** if the goal
is “harden the scaffold everyone copies.” Doing both in one week is how
the workflow stays vapor.

**Owner (2026-10-23):** will pitch a **new game** for the trial.

---

### 7. videoReview on the recording — now or later

**What is actually broken:** screenshots miss motion (ghosting rocket,
input lag, unfair off-screen deaths). A recording helps humans; a vision
pass might help agents.

| Option | Reality check |
|---|---|
| **Now** | Extra moving part before we know spawn + PLAYTEST.md work |
| **Later** | Playwright checklist + human-watched recording may be enough for MVP QC |
| **Never** | Accept that F4/F7 motion issues need a human or a careful Playwright trace |

**Default later:** do not stack vision-model QC on top of an unproven critic
loop. Add it when PLAYTEST.md exists and we still see motion bugs slip
through.

**Owner (2026-10-23):** **now** — recording + motion review required.

---

## How the choices interact (so we don’t pick an incoherent set)

```
Brief present? ──no──► stop and ask owner (already written; currently ignored)
       │ yes
       ▼
Gate 0 (+ hardened smoke if we chose #3)
       │
       ▼
PLAYTEST.md required (#2)  ◄── fail-closed even if spawn fails (#1 B)
       │
       ▼
Spawn fresh critic if available (#1 A)
       │
       ▼
Builder feel pass ≤ N rounds (#5)
       │
       ▼
CI keeps gate 0 honest on the next PR (#4)
```

Incoherent combos to avoid:

- Fresh agent **without** artifact contract → spawn flake ⇒ no evidence.
- Hard smoke fail **on all games in CI** before upgrading Sharky → every PR
  blocked for unrelated reasons.
- Trial on three games at once → no clear signal whether the workflow failed
  or the game did.

---

## Suggested implementation order (when owner pitches the trial game)

1. Lock PLAYTEST schema (intent vs pitch, motion section, content complaints)
   + “not shipped / not precached” in the checker.
2. Add `game-playtest` skill: fresh agent, critical, pitch in prompt,
   **required recording + videoReview**, commit `PLAYTEST.md`.
3. Retarget `game-qc`: orchestrate builder → critic (≤3 rounds); content
   complaints in scope; no “playable” claim without PLAYTEST + recording.
4. Owner pitches new game → `new-game` → build → first real critic loop.
5. Smoke and CI stay as they are unless we revisit later.

---

## Open questions (engineering, not taste)

- Best spawn path in Cursor cloud: `Task` + `computerUse` vs Playwright MCP
  in-process vs a second cloud agent on the same branch. **Spike after we
  pick #1 and #6 — not before.**
- Whether playtest runs against a Cloudflare tunnel or only localhost
  (localhost is enough; tunnel is for humans).
- How aggressively to backfill QC briefs on Sharky / Apex / Yes-General
  (owner questionnaire once each) so `game-qc`’s “stop and ask” can become
  real.
