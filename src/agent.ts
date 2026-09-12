export type Player = "X" | "O";
export type Cell = Player | null;
export type Board = Cell[];

export const WINNING_LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function winner(board: Board): Player | null {
  for (const [a, b, c] of WINNING_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

export function isFull(board: Board): boolean {
  return board.every((cell) => cell !== null);
}

export function availableMoves(board: Board): number[] {
  const moves: number[] = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === null) moves.push(i);
  }
  return moves;
}

/**
 * Minimax with alpha-beta pruning. The agent plays `agent` and assumes the
 * human plays optimally too, so it plays a perfect (unbeatable) game.
 * Depth is used to prefer faster wins and slower losses.
 */
function minimax(
  board: Board,
  current: Player,
  agent: Player,
  depth: number,
  alpha: number,
  beta: number,
): number {
  const win = winner(board);
  if (win === agent) return 10 - depth;
  if (win !== null) return depth - 10;
  if (isFull(board)) return 0;

  const opponent: Player = agent === "X" ? "O" : "X";
  const isMaximizing = current === agent;
  let best = isMaximizing ? -Infinity : Infinity;

  for (const move of availableMoves(board)) {
    board[move] = current;
    const score = minimax(
      board,
      current === "X" ? "O" : "X",
      agent,
      depth + 1,
      alpha,
      beta,
    );
    board[move] = null;

    if (isMaximizing) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
  }
  void opponent;
  return best;
}

/**
 * Returns the index of the best move for `agent` on the given board,
 * or null if there are no moves available.
 */
export function chooseMove(board: Board, agent: Player): number | null {
  const moves = availableMoves(board);
  if (moves.length === 0) return null;

  let bestScore = -Infinity;
  let bestMove = moves[0];
  for (const move of moves) {
    board[move] = agent;
    const score = minimax(
      board,
      agent === "X" ? "O" : "X",
      agent,
      0,
      -Infinity,
      Infinity,
    );
    board[move] = null;
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove;
}
