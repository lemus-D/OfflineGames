# LongArms — design notes (MVP)

> build me a basketball game with guys with long arms who throw the ball
> whenever they jump I want cartoon style goofy
>
> Follow-up: make it like Basket Random

Side-view 1v1 chaos basketball in the *Basket Random* mould: every point the
bodies remorph (arms, legs, torso, jump), physics are floaty and rude, and
**jumping with the ball throws**. Closest vibes: Basket Random + rubber-hose
limbs.

Headings marked **[decided]** came from the owner and are not to be changed
without asking. Headings marked **[proposal]** are opening bids — implement,
then tune by playing.

## QC brief

Questionnaire asked in-chat with bracketed defaults; no reply before build.
Tone from the pitch, later steered to Basket Random.

| Field | Value | Source |
|---|---|---|
| shape | real-time arcade | [default] |
| run_band | 45 s – 4 min | [default] |
| inputs | both | [default] |
| orientation | any | [default] |
| sound | minimal | [default] |
| done_pct | 70 % | [default] |
| tone | Basket Random chaos; goofy remorphing long-arm jump-throwers | [owner] |
| persists | best score | [default] |
| non_goals | full ruleset, online multiplayer, career, 2v2 couch | [default] |

## The verb **[decided]**

Jump-throw the ball.

## Loop **[proposal]**

1. Tip-off: both players **remorph** (seeded); ball drops mid-court.
2. Pressure — opponent always hunts; **shot clock** still bites. Idle loses.
3. Reward — a dunk/swish inside a few seconds if you drive and jump near the rim.
4. After every make both players remorph again (Basket Random beat).
5. Fail — opponent reaches **WIN_SCORE** (5) first.
6. Run length: brief `run_band`; games-to-5 with remorph chaos.

## One more go **[proposal]**

- Persists: `bestScore` + `wins`.
- Summary: final score + near-miss + “bodies remorphed N times”.
- Restart is one tap.

## Controls **[proposal]**

- Keyboard: A/D or ←/→ move; Space / W / ↑ jump (throws if holding ball).
- Touch: left = move; JUMP pad = toss.

## Content tables **[proposal]**

| Table | Row example | What the player does differently because of it |
|---|---|---|
| `MORPH` | arm/leg/body/jump ranges | Changes reach, speed feel, dunk window every point |
| `PLAYERS` | base jersey / skin | Team identity under the morph |
| `HOOP` | rim height | Dunk vs lob threshold |
| `MATCH` | winScore 5, remorph | Match length + Basket Random reset |

## Feedback plan **[proposal]**

| Event | Visual | Sound |
|---|---|---|
| remorph | stretch pop, flash | rubber sproing |
| dribble | ball bob | soft tick |
| jump / throw | arms whip | boing + whoosh |
| dunk / score | slam zoom flash, +2 | stinger |
| steal | slap | rubber slap |
| win / lose | summary | up / down |

## Look **[proposal]**

Basket Random flat look: sky `#87ceeb`, court `#f4d19b`, line `#fff`, ink
`#222`, jerseys red/blue. Circle heads, blocky torsos, noodle limbs scaled by
morph. No fancy shading.

## Non-goals for the MVP

- Couch 2v2 / four-player local
- Online
- Career / unlocks
- Exact clone of Basket Random assets or netcode

## Open questions

- 2v2 with AI teammate — **[proposal]** defer; 1v1 remorph chaos first.

## Technical

Storage prefix `longarms.v1.`, port **5184**.

```bash
cd LongArms && npm start
cd LongArms && npm run smoke
node .cursor/skills/game-qc/scripts/check-game.mjs LongArms
```
