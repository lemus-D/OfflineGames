import { describe, expect, it } from "vitest";
import {
  type Board,
  availableMoves,
  chooseMove,
  isFull,
  winner,
} from "./agent";

describe("winner", () => {
  it("detects a row win", () => {
    const board: Board = ["X", "X", "X", null, null, null, null, null, null];
    expect(winner(board)).toBe("X");
  });

  it("detects a diagonal win", () => {
    const board: Board = ["O", null, null, null, "O", null, null, null, "O"];
    expect(winner(board)).toBe("O");
  });

  it("returns null when there is no winner", () => {
    const board: Board = ["X", "O", "X", null, null, null, null, null, null];
    expect(winner(board)).toBeNull();
  });
});

describe("board helpers", () => {
  it("reports a full board", () => {
    const board: Board = ["X", "O", "X", "X", "O", "O", "O", "X", "X"];
    expect(isFull(board)).toBe(true);
    expect(availableMoves(board)).toEqual([]);
  });

  it("lists the open squares", () => {
    const board: Board = ["X", null, null, null, "O", null, null, null, null];
    expect(availableMoves(board)).toEqual([1, 2, 3, 5, 6, 7, 8]);
  });
});

describe("chooseMove (minimax agent)", () => {
  it("takes an immediate winning move", () => {
    // O can win by playing index 2.
    const board: Board = ["O", "O", null, "X", "X", null, null, null, null];
    expect(chooseMove(board.slice(), "O")).toBe(2);
  });

  it("blocks the opponent's winning move", () => {
    // X threatens to win at index 2; O must block there.
    const board: Board = ["X", "X", null, null, "O", null, null, null, null];
    expect(chooseMove(board.slice(), "O")).toBe(2);
  });

  it("never loses against a brute-force opponent", () => {
    // Play out every possible human game; the agent must always win or draw.
    const play = (board: Board, human: "X", agent: "O", turn: "X" | "O"): void => {
      const w = winner(board);
      if (w === agent) return; // agent won — fine
      expect(w).not.toBe(human); // agent must never allow a human win
      if (w || isFull(board)) return;

      if (turn === agent) {
        const move = chooseMove(board.slice(), agent);
        const next = board.slice();
        next[move!] = agent;
        play(next, human, agent, human);
      } else {
        for (const move of availableMoves(board)) {
          const next = board.slice();
          next[move] = human;
          play(next, human, agent, agent);
        }
      }
    };
    play(Array(9).fill(null), "X", "O", "X");
  });
});
