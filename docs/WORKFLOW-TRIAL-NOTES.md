# Workflow trial notes — bunny/fox chase (monitor)

Parent monitors; builder is a separate cloud agent. Goal: find inefficiencies
and errors in `new-game` → build → `game-qc` → `game-playtest` (fresh critic).

## Trial setup

| | |
|---|---|
| Builder | [Bunny fox chase game](bc-f8967793-d52c-5167-9011-5f1b80933ca0) |
| Critic (parent-spawned) | [GroveRun polish critic](bc-021ac816-8eb7-5517-92e7-2669e92ac373) |
| Builder branch | `cursor/grove-run-mvp-6c6d` @ `a1ec20b` |
| Game | `GroveRun/` port **5184** |
| Game PR | https://github.com/lemus-D/OfflineGames/pull/12 (draft) |
| Base for builder | `cursor/qc-playtest-brainstorm-6c6d` |

## Findings (after builder completion)

### Inefficiencies

1. **Critic spawn is not available inside cloud builder subagents.** Builder had no Task / computerUse tool, correctly refused to self-playtest, and stopped. The loop requires a **parent** (or a builder with spawn rights) to start the critic — `game-qc` Step 2 as written assumes spawn always works in-agent.
2. **PR creation blocked in the builder.** `gh pr create` → *Resource not accessible by integration*; no `ManagePullRequest`. Extra human/parent hop just to open a draft.
3. **CRITIC_SPAWN.md tip-sha churn.** Three commits only to refresh the spawn prompt SHA (`ed3cfc7`, `b337e8e`, `a1ec20b`) — noise; prompt should say `git rev-parse --short HEAD` once (final prompt does; earlier commits wasted cycles).
4. **Skills not on `main`.** Builder had to base on the QC brainstorm branch so `game-playtest` exists. Landing games and landing the framework are coupled until #11 merges.

### Errors / skill gaps

1. **`game-qc` does not define a fallback when spawn tools are missing** beyond “ask the owner.” For cloud subagents that is the common case — should say: write `CRITIC_SPAWN.md`, stop, parent spawns critic (which is what the builder improvised — promote that into the skill).
2. **No ManagePullRequest / gh write in builder subagent** — skill says open/update PR; tool cannot. Document parent-opens-PR or grant the tool.
3. PLAYTEST.md / recording / builder rounds **not started** — blocked on (1), not on game quality.

### What worked

1. Fresh directory name `GroveRun` (not reusing an old chase name); port **5184**.
2. Followed build order narrative: plan → scaffold → content → play → smoke → draw → …
3. Gate 0 claimed PASS; browser suite claimed 0 console errors; did **not** claim playable without critic.
4. Left a clear handoff artifact: `GroveRun/CRITIC_SPAWN.md`.
5. Copied `game-playtest` onto the branch when needed for the critic.

### Parent follow-up (this session)

- Opened draft PR #12 for `cursor/grove-run-mvp-6c6d`.
- Spawned [GroveRun polish critic](bc-021ac816-8eb7-5517-92e7-2669e92ac373) on that branch (cloud `computerUse`).
- Awaiting critic `PLAYTEST.md` + recording; then builder rounds if `not_ready`.

## Skill fixes to make (recommended)

| Change | Where |
|---|---|
| Document “no spawn tools → write CRITIC_SPAWN.md and stop” as the standard path for subagents | `game-qc/SKILL.md` |
| Document “no PR tool → push branch + compare URL; parent opens PR” | `game-qc` / `new-game` |
| Merge QC skills to `main` before the next greenfield trial | PR #11 |
| Avoid per-sha CRITIC_SPAWN commits | builder habit / spawn template |
