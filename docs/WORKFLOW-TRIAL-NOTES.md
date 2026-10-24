# Workflow trial notes — bunny/fox chase (monitor)

Parent monitors; builder is a separate cloud agent. Goal: find inefficiencies
and errors in `new-game` → build → `game-qc` → `game-playtest` (fresh critic).

## Trial setup

| | |
|---|---|
| Builder agent | `[Bunny fox chase game](bc-f8967793-d52c-5167-9011-5f1b80933ca0)` |
| Base branch | `cursor/qc-playtest-brainstorm-6c6d` (skills live here; not yet on `main`) |
| Pitch | Temple Run–style bunny vs fox endless chase (verbatim in builder prompt) |
| Old chase work | **Forbidden** in builder prompt — fresh directory/name required |
| QC brief | Pre-filled in prompt so the trial is not blocked on questionnaire |

## What the parent is watching for

1. Does the builder actually read `new-game` / scaffold from Apex + Sharky audio/touch?
2. Port / directory collisions with games already on the branch.
3. Does gate 0 run before any “playable” claim?
4. Is the browser console suite run by the orchestrator (not dumped on the critic)?
5. Is a **fresh** critic subagent spawned, or does the builder self-playtest?
6. Is `PLAYTEST.md` committed with `ready_for_owner` / `not_ready` + recording?
7. Are builder response rounds capped and does re-critic happen after fixes?
8. Skill friction: unclear steps, missing tools, spawn failures, SW/precache footguns.
9. Time sinks: polish before smoke, drawing before PlaySession, skipped brief fields.

## Findings

_(Filled after the builder finishes or when artifacts are available.)_

### Inefficiencies

-

### Errors / skill gaps

-

### What worked

-
