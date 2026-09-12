import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type Board,
  type Player,
  chooseMove,
  isFull,
  winner,
} from "./agent";

const HUMAN: Player = "X";
const AGENT: Player = "O";
const EMPTY_BOARD: Board = Array(9).fill(null);

type Score = { human: number; agent: number; draws: number };

type Status =
  | { kind: "playing"; turn: Player }
  | { kind: "win"; player: Player }
  | { kind: "draw" };

function evaluate(board: Board, turn: Player): Status {
  const w = winner(board);
  if (w) return { kind: "win", player: w };
  if (isFull(board)) return { kind: "draw" };
  return { kind: "playing", turn };
}

export default function App() {
  const [board, setBoard] = useState<Board>(EMPTY_BOARD);
  const [turn, setTurn] = useState<Player>(HUMAN);
  const [score, setScore] = useState<Score>({ human: 0, agent: 0, draws: 0 });
  const [scored, setScored] = useState(false);

  const status = useMemo(() => evaluate(board, turn), [board, turn]);
  const gameOver = status.kind !== "playing";

  const handleClick = useCallback(
    (index: number) => {
      if (board[index] !== null || gameOver || turn !== HUMAN) return;
      const next = board.slice();
      next[index] = HUMAN;
      setBoard(next);
      setTurn(AGENT);
    },
    [board, gameOver, turn],
  );

  // The agent takes its turn whenever it is O's move and the game is live.
  useEffect(() => {
    if (turn !== AGENT || gameOver) return;
    const timer = setTimeout(() => {
      const move = chooseMove(board.slice(), AGENT);
      if (move === null) return;
      const next = board.slice();
      next[move] = AGENT;
      setBoard(next);
      setTurn(HUMAN);
    }, 350);
    return () => clearTimeout(timer);
  }, [turn, board, gameOver]);

  // Record the result exactly once per finished game.
  useEffect(() => {
    if (!gameOver || scored) return;
    setScored(true);
    setScore((prev) => {
      if (status.kind === "win") {
        return status.player === HUMAN
          ? { ...prev, human: prev.human + 1 }
          : { ...prev, agent: prev.agent + 1 };
      }
      return { ...prev, draws: prev.draws + 1 };
    });
  }, [gameOver, scored, status]);

  const reset = useCallback(() => {
    setBoard(EMPTY_BOARD);
    setTurn(HUMAN);
    setScored(false);
  }, []);

  const banner = (() => {
    if (status.kind === "win") {
      return status.player === HUMAN
        ? "You win! 🎉"
        : "The agent wins 🤖";
    }
    if (status.kind === "draw") return "It's a draw 🤝";
    return turn === HUMAN ? "Your move" : "Agent is thinking…";
  })();

  return (
    <main className="app">
      <header className="header">
        <h1>Agentic Game Making</h1>
        <p className="subtitle">
          Tic-Tac-Toe against a minimax AI agent (it never loses)
        </p>
      </header>

      <section className="scoreboard" aria-label="scoreboard">
        <div className="score">
          <span className="score-label">You (X)</span>
          <span className="score-value" data-testid="score-human">
            {score.human}
          </span>
        </div>
        <div className="score">
          <span className="score-label">Draws</span>
          <span className="score-value" data-testid="score-draws">
            {score.draws}
          </span>
        </div>
        <div className="score">
          <span className="score-label">Agent (O)</span>
          <span className="score-value" data-testid="score-agent">
            {score.agent}
          </span>
        </div>
      </section>

      <p
        className={`banner ${gameOver ? "banner-over" : ""}`}
        data-testid="status"
        role="status"
      >
        {banner}
      </p>

      <div className="board" role="grid">
        {board.map((cell, i) => (
          <button
            key={i}
            className={`cell ${cell ? `cell-${cell.toLowerCase()}` : ""}`}
            onClick={() => handleClick(i)}
            disabled={cell !== null || gameOver || turn !== HUMAN}
            aria-label={`cell ${i + 1}${cell ? `, ${cell}` : ", empty"}`}
            data-testid={`cell-${i}`}
          >
            {cell}
          </button>
        ))}
      </div>

      <button className="reset" onClick={reset} data-testid="reset">
        New game
      </button>
    </main>
  );
}
