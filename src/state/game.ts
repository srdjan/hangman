import { getCategoryByName } from "../data/wordLists.ts";
import { WordDifficulty, GameState, TwoPlayerGameState, PlayerGameState, Player, TwoPlayerGameStatus } from "../types.ts";
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
  difficulty: WordDifficulty = "medium",
  category: string = "General",
  hintsAllowed: number = 1
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
    }
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

/**
 * Create a player game state for two-player mode
 */
const createPlayerGameState = (
  playerId: Player,
  playerName: string,
  difficulty: WordDifficulty = "medium",
  category: string = "General",
  hintsAllowed: number = 1
): Result<PlayerGameState, Error> => {
  const wordResult = selectRandomWord(difficulty, category);

  if (!wordResult.ok) {
    return wordResult;
  }

  return ok({
    playerId,
    playerName,
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
    endTime: null
  });
};

/**
 * Create initial two-player game state
 */
export const createTwoPlayerGame = (
  player1Name: string = "Player 1",
  player2Name: string = "Player 2",
  difficulty: WordDifficulty = "medium",
  category: string = "General",
  hintsAllowed: number = 1
): Result<TwoPlayerGameState, Error> => {
  const player1Result = createPlayerGameState("player1", player1Name, difficulty, category, hintsAllowed);
  if (!player1Result.ok) {
    return player1Result;
  }

  const player2Result = createPlayerGameState("player2", player2Name, difficulty, category, hintsAllowed);
  if (!player2Result.ok) {
    return player2Result;
  }

  return ok({
    id: crypto.randomUUID(),
    player1: player1Result.value,
    player2: player2Result.value,
    currentTurn: "player1",
    gameStatus: "playing",
    roundNumber: 1,
    scores: {
      player1: 0,
      player2: 0
    },
    startTime: Date.now(),
    endTime: null
  });
};

/**
 * Process a player's guess in a two-player game
 */
const processPlayerGuess = (playerState: PlayerGameState, letter: string): Result<PlayerGameState, Error> => {
  // If player's game is not playing, return state unchanged
  if (playerState.status !== "playing") {
    return ok(playerState);
  }

  // Validate the letter
  const validatedLetter = validateGuess(letter);
  if (!validatedLetter.ok) {
    return validatedLetter;
  }

  // Already guessed this letter
  if (playerState.guessedLetters.has(validatedLetter.value)) {
    return ok(playerState);
  }

  // Create new set with the guessed letter added
  const newGuessedLetters = new Set(playerState.guessedLetters);
  newGuessedLetters.add(validatedLetter.value);

  // Calculate new wrong guesses
  const newWrongGuesses =
    playerState.word.includes(validatedLetter.value)
      ? playerState.wrongGuesses
      : playerState.wrongGuesses + 1;

  // Determine if the word is complete
  const isWordGuessed = [...playerState.word].every(l => newGuessedLetters.has(l));

  // Determine new game status
  const newStatus =
    isWordGuessed
      ? "won" as const
      : newWrongGuesses >= playerState.maxWrong
        ? "lost" as const
        : "playing" as const;

  const endTime = newStatus !== "playing" ? Date.now() : null;

  // Return new immutable state
  return ok({
    ...playerState,
    guessedLetters: newGuessedLetters,
    wrongGuesses: newWrongGuesses,
    status: newStatus,
    endTime
  });
};

/**
 * Determine the overall game status based on both players' states
 */
const determineTwoPlayerGameStatus = (player1: PlayerGameState, player2: PlayerGameState): TwoPlayerGameStatus => {
  if (player1.status === "won" && player2.status === "won") {
    // Both won - this shouldn't happen in normal gameplay, but handle it
    return "gameOver";
  } else if (player1.status === "won") {
    return "player1Won";
  } else if (player2.status === "won") {
    return "player2Won";
  } else if (player1.status === "lost" && player2.status === "lost") {
    return "bothLost";
  } else if (player1.status === "lost" || player2.status === "lost") {
    // One player lost but the other is still playing - game continues
    return "playing";
  } else {
    return "playing";
  }
};

/**
 * Process a guess in a two-player game with turn management
 */
export const processTwoPlayerGuess = (state: TwoPlayerGameState, letter: string): Result<TwoPlayerGameState, Error> => {
  // If game is over, return state unchanged
  if (state.gameStatus !== "playing") {
    return ok(state);
  }

  // Get the current player's state
  const currentPlayer = state.currentTurn === "player1" ? state.player1 : state.player2;

  // Process the guess for the current player
  const updatedPlayerResult = processPlayerGuess(currentPlayer, letter);
  if (!updatedPlayerResult.ok) {
    return updatedPlayerResult;
  }

  const updatedPlayer = updatedPlayerResult.value;

  // Update the game state with the new player state
  const updatedState = state.currentTurn === "player1"
    ? { ...state, player1: updatedPlayer }
    : { ...state, player2: updatedPlayer };

  // Determine the new overall game status
  const newGameStatus = determineTwoPlayerGameStatus(updatedState.player1, updatedState.player2);

  // Switch turns if the game is still playing and the guess was processed
  const nextTurn = newGameStatus === "playing" && updatedPlayer.guessedLetters.size > currentPlayer.guessedLetters.size
    ? (state.currentTurn === "player1" ? "player2" : "player1")
    : state.currentTurn;

  // Calculate scores and end time
  const endTime = newGameStatus !== "playing" ? Date.now() : null;
  const scores = { ...state.scores };

  if (newGameStatus === "player1Won") {
    scores.player1 += 1;
  } else if (newGameStatus === "player2Won") {
    scores.player2 += 1;
  }

  return ok({
    ...updatedState,
    currentTurn: nextTurn,
    gameStatus: newGameStatus,
    scores,
    endTime
  });
};