# UnfairPickle — design notes (MVP)

> make me a unfair mario clone but replace mario with a pickle

Side-scrolling platformer in the Unfair Mario / troll-platformer vein.
You are a dill pickle. Ten hand-authored levels of gleefully unfair traps
(fake floors, invisible blocks, fake goals). Closest references: Unfair
Mario (Flash), I Wanna Be The Guy (lighter).

## QC brief

| Field | Value | Source |
|---|---|---|
| shape | real-time arcade | [default] |
| run_band | 10 levels ≈ 15 min perfect clear; a life is a level attempt | [owner] |
| inputs | keyboard | [owner] |
| orientation | landscape | [owner] |
| sound | minimal | [owner] |
| done_pct | 70 % | [default] |
| tone | silly pixel art style | [owner] |
| persists | best clear time + fewest deaths | [owner] |
| non_goals | no level editor; just the 10 levels; no touch UI this version | [owner] |

## The verb **[proposal]**

Jump the pickle right.

## Loop **[proposal]**

1. Spawn at level start; run and jump toward the flag.
2. Pressure — rising brine after the level timer; traps that punish greed.
3. Reward — level clear toast within the first screen of L1; campaign clear.
4. Fail — spikes, voids, fake goals, brine. Death restarts the level.
5. Run length: brief's band for a clean campaign; deaths stretch it.

## One more go **[proposal]**

- Persist best full-clear time and fewest deaths (campaign).
- Summary names near-miss vs best time / death count.
- Restart / next level is one key or one click.

## Controls **[proposal]**

- Keyboard: ←→ / A D move, ↑ / W / Space jump. R restart level after death.

## Content tables **[proposal]**

| Table | Row example | What the player does differently |
|---|---|---|
| TILES | `~` fake floor | Trust looks → fall; learn to skip |
| TILES | `?` invisible brick | Bump / probe before jumping |
| TILES | `F` fake flag | Don't touch the first flag |
| LEVELS | 10 maps | Escalating trap vocabulary |
| HAZARDS | spike / brine | Route choice |

## Feedback plan **[proposal]**

| Event | Visual | Sound |
|---|---|---|
| jump | squash/stretch | soft blip |
| land | dust puffs | thud |
| die | flash + pickle splat | fail buzz |
| clear | flag wave + confetti | reward arpeggio |
| vanish / spring | tile pop / launch streak | action chirp |

## Look **[proposal]**

Pixel art, 16 px tiles. Dill green pickle silhouette with bumpy highlights,
sky teal → mint gradient, brick terracotta, spike charcoal, brine sickly
yellow-green. Parallax hills behind.

## Non-goals for the MVP

- Level editor, multiplayer, more than 10 levels, touch controls, power-ups.

## Open questions

None blocking — trap density tuned by playing.

## Technical

House rules (`AGENTS.md`). Storage `unfair-pickle.v1.`, port **5184**.

```bash
cd UnfairPickle && npm start
cd UnfairPickle && npm run smoke
node .cursor/skills/game-qc/scripts/check-game.mjs UnfairPickle
```
