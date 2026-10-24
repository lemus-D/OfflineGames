# GroveRun — design notes (MVP)

> Temple Run–style endless runner chase. You play as a bunny on a winding path. A fox is always behind you. Switch lanes and jump to dodge obstacles, grab carrots, and survive as long as you can. Dusk woodland mood; ink-outline readable silhouettes; the fox should feel predatory. Mobile-shaped installable PWA.

Endless 3-lane chase runner. Closest references: Temple Run (lanes + jump + chaser) and Subway Surfers (lane switch clarity).

Headings marked **[decided]** came from the owner and are not to be changed
without asking. Headings marked **[proposal]** are opening bids — implement,
then tune by playing.

## QC brief

| Field | Value | Source |
|---|---|---|
| shape | real-time arcade | [owner] |
| run_band | 45 s – 4 min | [owner] |
| inputs | both | [owner] |
| orientation | any | [owner] |
| sound | minimal | [owner] |
| done_pct | 70 % | [owner] |
| tone | dusk woodland, ink outlines, cute bunny vs mean fox; readable silhouettes | [owner] |
| persists | best score | [owner] |
| non_goals | no multiplayer; no meta unlock tree for MVP; no licensed art | [owner] |

## The verb **[proposal]**

Lane-hop and leap.

## Loop **[proposal]**

1. Bunny starts mid-lane; path auto-scrolls forward; fox trails just off-screen.
2. Pressure — rising scroll speed + fox gap that closes on hits/stumbles; idle into an obstacle ends the run within ~30 s.
3. Reward — carrots every few seconds; first carrot inside 5 s; score from distance + carrots.
4. Fail — hit a hard obstacle, or fox gap reaches zero after a stumble.
5. Run length: 45 s – 4 min for a good run.

## One more go **[proposal]**

- Persists: best score (distance + carrots).
- Summary: score, distance, carrots, near-miss (“fox was X m back”), best.
- Restart is one tap (Play again).

## Controls **[proposal]**

- Keyboard: ←/→ or A/D lane; ↑/W/Space jump.
- Touch (390 × 844): swipe L/R lane, swipe up jump; tap zones left/right/up as fallback. Thumb strip stays clear of HUD top.

## Content tables **[proposal]**

| Table | Row example | What the player does differently because of it |
|---|---|---|
| OBSTACLES | `log` (jump), `rock` (lane change), `root` (jump or lane) | Forces different dodge verbs |
| PICKUPS | `carrot` | Score bump; optional tiny fox-gap relief |
| SPEED | ramp rows by distance | Same verbs under tighter timing |

## Feedback plan **[proposal]**

| Event | Visual | Sound |
|---|---|---|
| lane switch | bunny slides; dust puff | soft thud |
| jump | arc + shadow squash | short blip |
| carrot | pop + score tick | reward beep |
| near miss / fox close | screen edge vignette; fox silhouette larger | low growl tick |
| hit / catch | flash red; fox leap | fail saw |

## Look **[proposal]**

Palette: dusk indigo `#1a2438`, warm orange `#e07040`, cream `#f0e6d0`, fox russet `#c45a2a`, path ochre `#6b5344`, ink `#0e1218`. Thick ink outlines; flat fills; bunny cream silhouette vs fox dark russet; layered tree silhouettes for depth; winding path perspective (pseudo-3D lane corridors).

## Non-goals for the MVP

- No multiplayer
- No meta unlock tree
- No licensed art / asset files
- No slide-under move (jump + lanes only)

## Open questions

None blocking. Power-ups deferred **[proposal]**.

## Technical

Storage prefix `grove-run.v1.`, port 5184.

```bash
cd GroveRun && npm start
cd GroveRun && npm run smoke
node .cursor/skills/game-qc/scripts/check-game.mjs GroveRun
```
