# LongArms — design notes (MVP)

> build me a basketball game with guys with long arms who throw the ball
> whenever they jump I want cartoon style goofy

Side-view 1v1 half-court basketball. Stretchy goofball limbs; every jump with
the ball is a throw. Closest vibes: *NBA Jam* chaos + rubber-hose cartoons.

Headings marked **[decided]** came from the owner and are not to be changed
without asking. Headings marked **[proposal]** are opening bids — implement,
then tune by playing.

## QC brief

Questionnaire asked in-chat with bracketed defaults; no reply before build.
Tone taken from the pitch. Remaining fields used as proposed defaults.

| Field | Value | Source |
|---|---|---|
| shape | real-time arcade | [default] |
| run_band | 45 s – 4 min | [default] |
| inputs | both | [default] |
| orientation | any | [default] |
| sound | minimal | [default] |
| done_pct | 70 % | [default] |
| tone | goofy cartoon; long-armed jump-throwers | [owner] |
| persists | best score | [default] |
| non_goals | full ruleset, online multiplayer, career mode | [default] |

## The verb **[decided]**

Jump-throw the ball.

## Loop **[proposal]**

1. Tip-off: ball drops mid-court; first to grab it gets possession.
2. Pressure — **shot clock** (12 s). Hold too long → turnover. AI always hunts.
   Standing still loses the ball or gets scored on inside ~30 s.
3. Reward — a made basket (2 pts) inside the first few possessions; first make
   reachable under ~5 s for an aggressive jumper near the rim.
4. Fail — opponent reaches **WIN_SCORE** first (or you never score and they do).
5. Run length: brief `run_band` (45 s – 4 min); games-to-12 aim for that band.

## One more go **[proposal]**

- Persists: `bestScore` (points you scored in a finished match) + `wins`.
- Summary: final score, your points, near-miss (“opponent won by 2” / “you
  needed one more bucket”).
- Restart is one tap / one key.

## Controls **[proposal]**

- Keyboard: A/D or ←/→ move; Space / W / ↑ jump (throws if holding ball).
- Touch (390 × 844): left half drag/hold = move; right-side JUMP button;
  thumb zone clears the hoop and scoreboard.

## Content tables **[proposal]**

| Table | Row example | What the player does differently because of it |
|---|---|---|
| `PLAYERS` | `reach`, `jumpVel`, `throwSpeed`, `armLen` | Longer reach grabs earlier; jumpVel changes throw timing windows |
| `HOOP` | rim height, backboard | Changes the lob target the jump-throw aims at |
| `AI` | aggressiveness, missBias | How hard the opponent pressures you |
| `MATCH` | winScore, shotClock | Match length and possession urgency |

Rows that only nudge numbers (friction, gravity) are marked as tuning pads.

## Feedback plan **[proposal]**

| Event | Visual | Sound |
|---|---|---|
| jump / throw | arms whip, ball arcs | springy boing + whoosh |
| score | rim splash, +2 pop | swish chord |
| rebound / steal | arm stretch slap | rubber slap |
| shot-clock warn | HUD pulse red | tick-up beep |
| win / lose | summary banner | bright / down slide |

## Look **[proposal]**

Palette: court maple `#e8b86a`, sky mint `#7ec8c4`, ink `#1a1a2e`, jersey
tomato `#e85d4c` / blueberry `#3d6ea5`, ball `#f07828`. Fat outlines, rubber-hose
arms, oversized shoes, no realistic shading. Silhouette: tiny torso, noodle arms
to the knees, ball glued to a long hand. Background: flat gym wall + window
stripes for depth.

## Non-goals for the MVP

- Full FIBA/NBA rules, fouls, free throws, three-point arc scoring
- Online / local couch hotseat (AI only this version)
- Career, unlocks, cosmetics shop
- Pixel-perfect collision physics library

## Open questions

- Full court vs half court — **[proposal]** half court, one hoop, alternate
  possession after each make (keeps the throw readable).
- Win score — **[proposal]** first to 12 (by 1; 2 pts per basket).

## Technical

Same house rules as the rest of the repo (`AGENTS.md`). Storage prefix
`longarms.v1.`, port **5184**.

```bash
cd LongArms && npm start
cd LongArms && npm run smoke
node .cursor/skills/game-qc/scripts/check-game.mjs LongArms
```
