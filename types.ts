// Define the game difficulty levels
export type WordDifficulty = "easy" | "medium" | "hard";

// Define the possible game states
export type GameStatus = "playing" | "won" | "lost";

// Define the shape of our game state
export interface GameState {
  readonly id: string;
  readonly word: string;
  readonly guessedLetters: ReadonlySet<string>;
  readonly wrongGuesses: number;
  readonly maxWrong: number;
  readonly status: GameStatus;
  readonly difficulty: WordDifficulty;
}

// Define a union type for guess results
export type GuessResult =
  | { kind: "correct"; letter: string }
  | { kind: "incorrect"; letter: string }
  | { kind: "alreadyGuessed"; letter: string }
  | { kind: "won"; word: string }
  | { kind: "lost"; word: string };