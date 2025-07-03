import { getCategoryByName } from "../data/wordLists.ts";
import { WordDifficulty, GameState } from "../types.ts";
import { Result, ok, err } from "../utils/result.ts";

/**
 * Select a random word from the appropriate word list using type assertion
 * with appropriate runtime safeguards
 */
export const selectRandomWord = (difficulty: WordDifficulty, category: string = "General"): Result<string, Error> => {
  const wordCategory = getCategoryByName(category);
  const words = wordCategory.words[difficulty];

  if (!words || words.length === 0) {
    return err(new Error(`No words available for difficulty level: ${difficulty} in category: ${category}`));
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
export const createGame = (
  difficulty: WordDifficulty = "hard",
  category: string = "Words",
  hintsAllowed: number = 1,
  username?: string
): Result<GameState, Error> => {
  const wordResult = selectRandomWord(difficulty, category);

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
    category,
    hintsUsed: 0,
    hintsAllowed,
    startTime: Date.now(),
    endTime: null,
    statistics: {
      gamesPlayed: 0,
      gamesWon: 0,
      currentStreak: 0,
      bestStreak: 0,
      totalGuesses: 0,
      averageGuessesPerWin: 0
    },
    username
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

  // Calculate game statistics
  let statistics = { ...state.statistics };
  const totalGuesses = state.guessedLetters.size + 1; // Include this guess

  if (newStatus === "won") {
    const endTime = Date.now();
    statistics = {
      ...statistics,
      gamesPlayed: statistics.gamesPlayed + 1,
      gamesWon: statistics.gamesWon + 1,
      currentStreak: statistics.currentStreak + 1,
      bestStreak: Math.max(statistics.bestStreak, statistics.currentStreak + 1),
      totalGuesses: statistics.totalGuesses + totalGuesses,
      averageGuessesPerWin: Math.round((statistics.totalGuesses + totalGuesses) / (statistics.gamesWon + 1))
    };
    return ok({
      ...state,
      guessedLetters: newGuessedLetters,
      wrongGuesses: newWrongGuesses,
      status: newStatus,
      endTime,
      statistics
    });
  } else if (newStatus === "lost") {
    const endTime = Date.now();
    statistics = {
      ...statistics,
      gamesPlayed: statistics.gamesPlayed + 1,
      currentStreak: 0,
      totalGuesses: statistics.totalGuesses + totalGuesses
    };
    return ok({
      ...state,
      guessedLetters: newGuessedLetters,
      wrongGuesses: newWrongGuesses,
      status: newStatus,
      endTime,
      statistics
    });
  }

  // Return new immutable state for ongoing game
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

/**
 * Get a hint (reveal an unguessed letter)
 */
export const getHint = (state: GameState): Result<GameState, Error> => {
  // If game is not playing, return state unchanged
  if (state.status !== "playing") {
    return ok(state);
  }

  // Check if hints are available
  if (state.hintsUsed >= state.hintsAllowed) {
    return ok(state); // No hints left, return unchanged state
  }

  // Find unguessed letters in the word
  const unguessedLetters = [...state.word].filter(letter => !state.guessedLetters.has(letter));

  // If all letters are already guessed, return unchanged state
  if (unguessedLetters.length === 0) {
    return ok(state);
  }

  // Select a random unguessed letter
  const hintLetter = unguessedLetters[Math.floor(Math.random() * unguessedLetters.length)];

  // Create new set with the hint letter added
  const newGuessedLetters = new Set(state.guessedLetters);
  newGuessedLetters.add(hintLetter);

  // Determine if the word is complete after adding the hint
  const isWordGuessed = [...state.word].every(l => newGuessedLetters.has(l));

  // Determine new game status
  const newStatus = isWordGuessed ? "won" as const : "playing" as const;

  // Calculate game statistics if game is won
  let statistics = { ...state.statistics };
  let endTime = null;

  if (newStatus === "won") {
    endTime = Date.now();
    const totalGuesses = state.guessedLetters.size + 1; // Include this hint as a guess
    statistics = {
      ...statistics,
      gamesPlayed: statistics.gamesPlayed + 1,
      gamesWon: statistics.gamesWon + 1,
      currentStreak: statistics.currentStreak + 1,
      bestStreak: Math.max(statistics.bestStreak, statistics.currentStreak + 1),
      totalGuesses: statistics.totalGuesses + totalGuesses,
      averageGuessesPerWin: Math.round((statistics.totalGuesses + totalGuesses) / (statistics.gamesWon + 1))
    };
  }

  // Return new immutable state
  return ok({
    ...state,
    guessedLetters: newGuessedLetters,
    hintsUsed: state.hintsUsed + 1,
    status: newStatus,
    endTime,
    statistics
  });
};