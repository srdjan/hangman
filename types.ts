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
}

/**
 * Define a discriminated union type for guess results
 * to enable exhaustive pattern matching
 */
export type GuessResult =
  | { readonly kind: "correct"; readonly letter: string }
  | { readonly kind: "incorrect"; readonly letter: string }
  | { readonly kind: "alreadyGuessed"; readonly letter: string }
  | { readonly kind: "won"; readonly word: string }
  | { readonly kind: "lost"; readonly word: string };