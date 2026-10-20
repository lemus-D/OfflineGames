# <Game> — design notes (MVP)

> Paste the owner's pitch here, verbatim.

One paragraph: what kind of game this is and the closest two references.

Headings marked **[decided]** came from the owner and are not to be changed
without asking. Headings marked **[proposal]** are opening bids — implement,
then tune by playing.

## The verb **[decided | proposal]**

Four words or fewer. What the player does every second.

## Loop **[decided | proposal]**

1. Start state.
2. The pressure — what forces action. Doing nothing loses within ~30 s.
3. The reward — what the player wants and how often it arrives (first one
   inside 5 s).
4. The fail state.
5. Target run length: ___ s to ___ min.

## One more go **[proposal]**

- What persists between runs (best, coins, unlocks).
- What the summary screen says — the total *and* the near-miss.
- Restart is one tap.

## Controls **[proposal]**

- Keyboard:
- Touch (390 × 844 portrait): where the thumb is, what it must not cover.

## Content tables **[proposal]**

| Table | Row example | What the player does differently because of it |
|---|---|---|
| | | |

Rows that only change a number are stat padding; say so if you keep them.

## Feedback plan **[proposal]**

| Event | Visual | Sound |
|---|---|---|
| | | |

Minimum sound set: action, reward, danger/fail, one ambient layer.

## Look **[proposal]**

Palette (3–5 colours + accents), line/shading rule, what makes the player
silhouette distinct, what gives the background depth.

## Non-goals for the MVP

-

## Open questions

Things the pitch did not settle. Ask only where a wrong guess wastes the
build; otherwise pick and mark **[proposal]**.

## Technical

Same house rules as the rest of the repo (`AGENTS.md`). Storage prefix
`<game>.v1.`, port ____.

```bash
cd <Game> && npm start
cd <Game> && npm run smoke
node .cursor/skills/game-qc/scripts/check-game.mjs <Game>
```
