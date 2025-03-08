import { WordDifficulty, GameState, GuessResult } from "../types.ts";

const wordLists: Record<WordDifficulty, readonly string[]> = {
  easy: ["HTML", "CSS", "VUE", "REACT", "NODE"] as const,
  medium: ["JAVASCRIPT", "TYPESCRIPT", "WEBCOMPONENT", "FRAMEWORK", "FRONTEND"] as const,
  hard: ["ASYNCHRONOUS", "OBSERVABLES", "AUTHENTICATION", "PROGRESSIVE", "ARCHITECTURE"] as const,
};

// Pure function to select a random word
export const selectRandomWord = (difficulty: WordDifficulty): string => {
  const words = wordLists[difficulty];
  return words[Math.floor(Math.random() * words.length)];
};

// Create initial game state
export const createGame = (difficulty: WordDifficulty = "medium"): GameState => ({
  id: crypto.randomUUID(),
  word: selectRandomWord(difficulty),
  guessedLetters: new Set<string>(),
  wrongGuesses: 0,
  maxWrong: 7,
  status: "playing",
  difficulty,
});

// Pure function to process a guess
export const processGuess = (state: GameState, letter: string): GameState => {
  // If game is not playing, return state unchanged
  if (state.status !== "playing") {
    return state;
  }

  // Already guessed this letter
  if (state.guessedLetters.has(letter)) {
    return state;
  }

  // Create new set with the guessed letter added
  const newGuessedLetters = new Set(state.guessedLetters);
  newGuessedLetters.add(letter);

  // Calculate new wrong guesses
  const newWrongGuesses =
    state.word.includes(letter)
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
  return {
    ...state,
    guessedLetters: newGuessedLetters,
    wrongGuesses: newWrongGuesses,
    status: newStatus,
  };
};

// Check if a letter has been guessed
export const hasGuessedLetter = (state: GameState, letter: string): boolean =>
  state.guessedLetters.has(letter);

// Get all guessed letters as an array
export const getGuessedLetters = (state: GameState): string[] =>
  Array.from(state.guessedLetters);

// Get word with only guessed letters revealed
export const getDisplayWord = (state: GameState): string[] =>
  [...state.word].map(letter =>
    state.guessedLetters.has(letter) ? letter : "");