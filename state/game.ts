import { WordDifficulty, GameState } from "../types.ts";
import { Result, ok, err } from "../utils/result.ts";

// Define word lists with explicit readonly arrays
const wordLists: Record<WordDifficulty, readonly string[]> = {
  easy: ["HTML", "CSS", "VUE", "REACT", "NODE"] as const,
  medium: ["JAVASCRIPT", "TYPESCRIPT", "WEBCOMPONENT", "FRAMEWORK", "FRONTEND"] as const,
  hard: ["ASYNCHRONOUS", "OBSERVABLES", "AUTHENTICATION", "PROGRESSIVE", "ARCHITECTURE"] as const,
};

/**
 * Select a random word from the appropriate word list using type assertion
 * with appropriate runtime safeguards
 */
export const selectRandomWord = (difficulty: WordDifficulty): Result<string, Error> => {
  const words = wordLists[difficulty];

  if (!words || words.length === 0) {
    return err(new Error(`No words available for difficulty level: ${difficulty}`));
  }

  // Type-safe access with runtime validation
  const word = words[Math.floor(Math.random() * words.length)];
  return typeof word === "string"
    ? ok(word)
    : err(new Error(`Expected string, got ${typeof word}`));
};

/**
 * Create initial game state
 */
export const createGame = (difficulty: WordDifficulty = "medium"): Result<GameState, Error> => {
  const wordResult = selectRandomWord(difficulty);

  if (!wordResult.ok) {
    return wordResult;
  }

  return ok({
    id: crypto.randomUUID(),
    word: wordResult.value,
    guessedLetters: new Set<string>(),
    wrongGuesses: 0,
    maxWrong: 7,
    status: "playing" as const,
    difficulty,
  });
};

/**
 * Validate a guess input
 */
const validateGuess = (letter: string): Result<string, Error> => {
  if (!letter) {
    return err(new Error("No letter provided"));
  }

  const normalizedLetter = letter.toUpperCase();
  if (!/^[A-Z]$/.test(normalizedLetter)) {
    return err(new Error(`Invalid letter: ${letter}`));
  }

  return ok(normalizedLetter);
};

/**
 * Process a guess, returning the updated game state
 */
export const processGuess = (state: GameState, letter: string): Result<GameState, Error> => {
  // If game is not playing, return state unchanged
  if (state.status !== "playing") {
    return ok(state);
  }

  // Validate the letter
  const validatedLetter = validateGuess(letter);
  if (!validatedLetter.ok) {
    return validatedLetter;
  }

  // Already guessed this letter
  if (state.guessedLetters.has(validatedLetter.value)) {
    return ok(state);
  }

  // Create new set with the guessed letter added
  const newGuessedLetters = new Set(state.guessedLetters);
  newGuessedLetters.add(validatedLetter.value);

  // Calculate new wrong guesses
  const newWrongGuesses =
    state.word.includes(validatedLetter.value)
      ? state.wrongGuesses
      : state.wrongGuesses + 1;

  // Determine if the word is complete
  const isWordGuessed = [...state.word].every(l => newGuessedLetters.has(l));

  // Determine new game status
  const newStatus =
    isWordGuessed
      ? "won" as const
      : newWrongGuesses >= state.maxWrong
        ? "lost" as const
        : "playing" as const;

  // Return new immutable state
  return ok({
    ...state,
    guessedLetters: newGuessedLetters,
    wrongGuesses: newWrongGuesses,
    status: newStatus,
  });
};

/**
 * Get word with only guessed letters revealed
 */
export const getDisplayWord = (state: GameState): Result<string[], Error> => {
  if (!state || !state.word) {
    return err(new Error("Invalid game state"));
  }

  return ok([...state.word].map(letter =>
    state.guessedLetters.has(letter) ? letter : ""));
};