# agenticGameMaking

A small, self-contained web game that pits you against an AI **agent**: a game
of Tic-Tac-Toe where the computer plays a perfect game using the minimax
algorithm with alpha-beta pruning. You (X) can never beat it — the best you can
do is draw.

Built with [Vite](https://vite.dev), [React](https://react.dev), and
TypeScript.

## Getting started

```bash
npm ci        # install dependencies (use `npm install` to refresh the lockfile)
npm run dev   # start the dev server on http://localhost:5173
```

Then open http://localhost:5173 and click a square to make your move; the agent
responds automatically.

## Scripts

| Command            | Description                                  |
| ------------------ | -------------------------------------------- |
| `npm run dev`      | Start the Vite dev server (port 5173)        |
| `npm run build`    | Type-check and build for production          |
| `npm run preview`  | Preview the production build (port 4173)     |
| `npm run lint`     | Run ESLint                                   |
| `npm run typecheck`| Type-check without emitting                  |
| `npm test`         | Run the unit tests (Vitest)                  |

## Project layout

```
src/
  agent.ts        # game rules + minimax AI agent
  agent.test.ts   # unit tests for the rules and agent
  App.tsx         # React UI (board, scoreboard, turn handling)
  main.tsx        # app entry point
  styles.css      # styling
```

## Cloud Agent environment

`.cursor/environment.json` configures the Cursor Cloud Agent environment:
`npm ci` installs dependencies and the `dev-server` terminal runs `npm run dev`
on port 5173.
