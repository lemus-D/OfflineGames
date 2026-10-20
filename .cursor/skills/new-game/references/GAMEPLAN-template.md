# <Game> — design notes (MVP)

> Paste the owner's pitch here, verbatim.

One paragraph: what kind of game this is and the closest two references.

Headings marked **[decided]** came from the owner and are not to be changed
without asking. Headings marked **[proposal]** are opening bids — implement,
then tune by playing.

## QC brief

The owner's answers to the questionnaire in the `new-game` skill. `game-qc`
scores against these. Mark each **[owner]** or **[default]**; never leave one
blank — ask.

| Field | Value | Source |
|---|---|---|
| shape | real-time arcade | [default] |
| run_band | 45 s – 4 min | [default] |
| inputs | both | [default] |
| orientation | any | [default] |
| sound | minimal | [default] |
| done_pct | 70 % | [default] |
| tone | | [owner] — no default |
| persists | best score | [default] |
| non_goals | | [owner] |

## The verb **[decided | proposal]**

Four words or fewer. What the player does every second.

## Loop **[decided | proposal]**

1. Start state.
2. The pressure — what forces action. Doing nothing loses within ~30 s.
3. The reward — what the player wants and how often it arrives (first one
   inside 5 s).
4. The fail state.
5. Run length: the brief's `run_band`.

## One more go **[proposal]**

- What persists between runs (best, coins, unlocks).
- What the summary screen says — the total *and* the near-miss.
- Restart is one tap.

## Controls **[proposal]**

One line per family in the brief's `inputs`.

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

Sound at the brief's level: `minimal` = action, reward, danger/fail;
`full` adds one ambient layer; `none` leaves the column empty on purpose.

## Look **[proposal]**

Palette (3–5 colours + accents), line/shading rule, what makes the player
silhouette distinct, what gives the background depth.

## Non-goals for the MVP

-

## Open questions

Things the pitch did not settle and the brief does not cover. Ask only where
a wrong guess wastes the build; otherwise pick and mark **[proposal]**.

## Technical

Same house rules as the rest of the repo (`AGENTS.md`). Storage prefix
`<game>.v1.`, port ____.

```bash
cd <Game> && npm start
cd <Game> && npm run smoke
node .cursor/skills/game-qc/scripts/check-game.mjs <Game>
```
