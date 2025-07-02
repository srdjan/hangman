/**
 * Define the game difficulty levels as a union of string literals
 * for compile-time type checking
 */
export type WordDifficulty = "easy" | "medium" | "hard";

/**
 * Define the possible game states as a union of string literals
 * for exhaustive pattern matching
 */
export type GameStatus = "playing" | "won" | "lost";

/**
 * Define game statistics interface
 */
export interface GameStatistics {
  readonly gamesPlayed: number;
  readonly gamesWon: number;
  readonly currentStreak: number;
  readonly bestStreak: number;
  readonly totalGuesses: number;
  readonly averageGuessesPerWin: number;
}

/**
 * Define the shape of our game state with readonly properties
 * to enforce immutability at the type level
 */
export interface GameState {
  readonly id: string;
  readonly word: string;
  readonly guessedLetters: ReadonlySet<string>;
  readonly wrongGuesses: number;
  readonly maxWrong: number;
  readonly status: GameStatus;
  readonly difficulty: WordDifficulty;
  readonly category: string;
  readonly hintsUsed: number;
  readonly hintsAllowed: number;
  readonly startTime: number;
  readonly endTime: number | null;
  readonly statistics: GameStatistics;
  readonly username?: string;
}

/**
 * Define a discriminated union type for guess results
 * to enable exhaustive pattern matching
 */
export type GuessResult =
  | { readonly kind: "correct"; readonly letter: string }
  | { readonly kind: "incorrect"; readonly letter: string }
  | { readonly kind: "alreadyGuessed"; readonly letter: string }
  | { readonly kind: "hint"; readonly letter: string }
  | { readonly kind: "won"; readonly word: string }
  | { readonly kind: "lost"; readonly word: string };

/**
 * Define hint result type
 */
export type HintResult =
  | { readonly kind: "revealed"; readonly letter: string }
  | { readonly kind: "noHintsLeft"; readonly hintsUsed: number; readonly hintsAllowed: number }
  | { readonly kind: "allLettersRevealed"; readonly word: string };