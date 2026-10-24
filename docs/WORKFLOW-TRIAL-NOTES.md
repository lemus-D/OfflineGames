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
