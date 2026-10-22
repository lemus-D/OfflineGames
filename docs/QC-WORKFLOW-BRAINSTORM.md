# QC workflow brainstorm — playtest agents and harder gates

> Branch: `cursor/qc-playtest-brainstorm-6c6d`
> Status: **proposal only.** No skill or checker changes land in this commit.
> Owner: pick options under [Decisions needed](#decisions-needed); then we implement.

Why this exists: gate 0 (`check-game.mjs` + smoke) is honest about the house
rules, but “playable / fun / done” still depends on the *same* coding agent
reading a long procedure, half-doing browser steps, and scoring its own work.
That is the weak joint. This note proposes a sharper workflow.

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
Playwright) subagent spawned by the builder/orchestrator, with no prior
build context. Prompt includes: game dir, port, path to QC brief, URL,
and “you are not allowed to modify source.”

**Hard rules for the playtest agent:**

- May start/stop the game’s `npm start` server.
- May use browser / Playwright / screen recorder.
- May write `<Game>/PLAYTEST.md` (or `artifacts/playtest-<sha>.md`) and
  drop screenshots/video under a known artifacts path.
- Must not edit `src/`, `sw.js`, plans, or smoke.
- Must not invent gate-2 scores without performing the written test for
  that criterion. Missing evidence → score 0 or `not checked`.

**Minimum playtest protocol (gate 1 + complaint list):**

1. Boot, console clean across load → start → 20 s play → die → restart.
2. Required input family from the brief (keyboard and/or touch @ 390×844).
3. Full loop without reload; screenshot summary.
4. Persistence: value survives reload; garbage profile → fresh boot.
5. Offline: second load, kill server, reload (same probe as
   `docs/PLATFORM-CONSTRAINTS.md`).
6. Three full runs “as a player,” then a ranked complaint list (10 max),
   player voice, no feature requests.
7. Optional: 30–60 s recording as the headline artifact.

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
| Max critic rounds before asking owner | 3 | Avoid infinite polish loops |
| Max levers per round | 3 | Matches current feel-pass “top three” |
| Playtest may edit code | **no** | Critic stays clean |
| Builder may edit PLAYTEST.md scores | **no** | Append only “Response” section |
| When to stop | gate 1 pass AND gate 2 ≥ `done_pct` AND top complaint is content | Same as current feel-pass stop rule |

---

## Proposal E — What we should *not* do

- **Don’t** put a LLM “fun score” with no protocol. The bar already has tests;
  the failure is execution, not missing vibes.
- **Don’t** share a runtime engine package to make testing easier (D7).
  Copy `feel.mjs` patterns like we copy `rng.js`.
- **Don’t** auto-promote a reference game from playtest scores.
- **Don’t** require human play for every commit — only for “approved” and
  maybe for first MVP merge of a new title.
- **Don’t** block on a perfect vision model. Start with Playwright actions +
  screenshots; optional later: videoReview subagent on the recording.

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

UnfairPickle already has a filled QC brief on its branch — good first victim
for an end-to-end playtest-agent trial once the skill exists.

---

## Decisions needed

Reply with numbers / short answers; defaults in brackets.

1. **Critic separation** — spawn a fresh playtest agent (A), or allow the
   builder to fill `PLAYTEST.md` with mandatory artifacts (B), or both
   (B now, A next)? **[both]**
2. **Where the report lives** — committed `<Game>/PLAYTEST.md` (overwritten
   each QC), or only PR artifacts / agent artifact store? **[commit
   PLAYTEST.md so the next agent can read it]**
3. **Smoke hardening** — fail arcade games missing determinism + idle-loses
   + progress asserts? **[yes]**
4. **CI** — add GitHub Action for gate 0 on PRs? **[yes, games touched only]**
5. **Max critic rounds** before pinging you? **[3]**
6. **First game to trial the new loop** — Apex (scaffold), Sharky (has
   audio/touch), or UnfairPickle (has brief)? **[Apex or UnfairPickle]**
7. **videoReview** on the recording as an extra critic pass? **[later]**

---

## Suggested implementation order (after decisions)

1. Lock output schema + AGENTS.md wording (small PR).
2. Harden `check-game.mjs` smoke contract + Apex `feel.mjs` as the template.
3. Add `game-playtest` skill; retarget `game-qc` to require its report.
4. Run one live trial: builder finishes a small change → spawn playtest →
   paste report in PR.
5. Add CI for gate 0.
6. Optional: videoReview pass; brief-aware static fails for audio/touch.

---

## Open questions (engineering, not taste)

- Best spawn path in Cursor cloud: `Task` + `computerUse` vs Playwright MCP
  in-process vs a second cloud agent on the same branch. Need one spike.
- How PLAYTEST.md interacts with service-worker cache bumps (report should
  not be precached — keep it out of `sw.js` PRECACHE; checker should ignore
  it as a non-shipped file).
- Whether playtest runs against the PR’s Cloudflare tunnel or only localhost
  (localhost is enough; tunnel is for humans).
