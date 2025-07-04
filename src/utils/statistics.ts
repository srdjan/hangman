import { GameState } from "../types.ts";
import { logError, logWarning, LogContext, GameLogger } from "./logger.ts";

/**
 * Game statistics utilities to consolidate duplicated statistics update logic
 */

/**
 * Update user statistics after a game completion or time expiration
 * Handles all the common error handling and logging patterns
 */
export async function updateGameStatistics(username: string, statistics: any): Promise<void> {
  if (!username) {
    logWarning(LogContext.STATS, "Cannot update statistics: no username provided");
    return;
  }

  try {
    const { updateUserStatistics } = await import("../auth/kv.ts");
    await updateUserStatistics(username, statistics);
    GameLogger.gameCompleted(statistics.gameId || 'unknown', username, 'completed', 0);
  } catch (error) {
    logError(LogContext.STATS, error as Error, { 
      operation: 'update_user_statistics', 
      username 
    });
    // Don't throw - we don't want statistics failures to break the game flow
  }
}

/**
 * Increment daily game count for a user
 * Consolidates the common pattern used across handlers
 */
export async function incrementDailyGameCount(username: string): Promise<void> {
  if (!username) {
    logWarning(LogContext.STATS, "Cannot increment daily game count: no username provided");
    return;
  }

  try {
    const { incrementDailyGameCount: incrementCount } = await import("../auth/kv.ts");
    await incrementCount(username);
    GameLogger.dailyLimitReached(username, 1); // Will be updated with actual count later
  } catch (error) {
    logError(LogContext.STATS, error as Error, { 
      operation: 'increment_daily_game_count', 
      username 
    });
    // Don't throw - we don't want this to break the game flow
  }
}

/**
 * Update player standings after a successful game completion
 * Handles the win-specific statistics updates
 */
export async function updatePlayerStandings(username: string, gameTimeSeconds: number): Promise<void> {
  if (!username) {
    logWarning(LogContext.STATS, "Cannot update player standings: no username provided");
    return;
  }

  if (gameTimeSeconds <= 0) {
    logWarning(LogContext.STATS, "Cannot update player standings: invalid game time", { gameTimeSeconds });
    return;
  }

  try {
    const { updatePlayerStanding } = await import("../auth/kv.ts");
    await updatePlayerStanding(username, gameTimeSeconds);
    GameLogger.gameCompleted('unknown', username, 'won', gameTimeSeconds);
  } catch (error) {
    logError(LogContext.STATS, error as Error, { 
      operation: 'update_player_standings', 
      username, 
      gameTimeSeconds 
    });
    // Don't throw - we don't want this to break the game flow
  }
}

/**
 * Log successful game completion with all associated data
 * Consolidates the common pattern for win sequence tracking
 */
export async function logGameCompletion(gameState: GameState, completionMethod: "guess" | "hint"): Promise<number> {
  const { getNextWinSequence, recordWin } = await import("../auth/kv.ts");
  
  const completionTime = new Date().toISOString();
  const username = gameState.username || "Anonymous";
  const word = gameState.word;
  const totalTime = gameState.endTime ? gameState.endTime - gameState.startTime : 0;
  const totalTimeSeconds = Math.round(totalTime / 1000);
  const totalGuesses = gameState.guessedLetters.size;
  const hintsUsed = gameState.hintsUsed;

  // Get the next win sequence number
  const sequenceNumber = await getNextWinSequence();

  console.log("🎉 GAME COMPLETED SUCCESSFULLY! 🎉");
  console.log("=" .repeat(50));
  console.log(`🏅 Win #${sequenceNumber} - Congratulations!`);
  console.log(`👤 Player: ${username}`);
  console.log(`📝 Word: ${word}`);
  console.log(`⏰ Completion Time: ${completionTime}`);
  console.log(`⏱️  Game Duration: ${totalTimeSeconds} seconds`);
  console.log(`🔤 Total Guesses: ${totalGuesses}`);
  console.log(`💡 Hints Used: ${hintsUsed}`);
  console.log(`✅ Completion Method: ${completionMethod === "guess" ? "Final letter guess" : "Hint revealed last letter"}`);
  console.log(`🏆 Difficulty: ${gameState.difficulty}`);
  console.log(`📂 Category: ${gameState.category}`);
  console.log("=" .repeat(50));

  // Record the win in persistent storage
  const winRecord = {
    sequenceNumber,
    username,
    word,
    completionTime,
    duration: totalTimeSeconds,
    totalGuesses,
    hintsUsed,
    completionMethod,
    difficulty: gameState.difficulty,
    category: gameState.category,
    gameId: gameState.id
  };

  await recordWin(winRecord);

  // Also log in structured format for potential log parsing
  const logEntry = {
    event: "game_completed",
    sequence_number: sequenceNumber,
    timestamp: completionTime,
    username,
    word,
    duration_seconds: totalTimeSeconds,
    total_guesses: totalGuesses,
    hints_used: hintsUsed,
    completion_method: completionMethod,
    difficulty: gameState.difficulty,
    category: gameState.category,
    game_id: gameState.id
  };

  console.log("STRUCTURED_LOG:", JSON.stringify(logEntry));
  
  return sequenceNumber;
}

/**
 * Handle all statistics updates for a completed game
 * Combines all the different update operations with proper error handling
 */
export async function handleGameCompletion(
  gameState: GameState,
  completionMethod: "guess" | "hint" | "timeout"
): Promise<number | null> {
  const username = gameState.username;
  let sequenceNumber: number | null = null;

  // Always increment daily game count for any completed game
  if (username) {
    await incrementDailyGameCount(username);
  }

  // Handle win-specific updates
  if (gameState.status === "won" && completionMethod !== "timeout") {
    sequenceNumber = await logGameCompletion(gameState, completionMethod);
    
    // Add sequence number to the game state for display
    gameState.winSequenceNumber = sequenceNumber;
    
    // Update player standings for wins
    if (username && gameState.endTime) {
      const gameTimeSeconds = Math.round((gameState.endTime - gameState.startTime) / 1000);
      await updatePlayerStandings(username, gameTimeSeconds);
    }
  }

  // Always save updated statistics to persistent storage if user is authenticated
  if (username) {
    await updateGameStatistics(username, gameState.statistics);
  }

  return sequenceNumber;
}

/**
 * Handle time expiration statistics
 * Specialized function for timeout scenarios
 */
export async function handleTimeExpiredStatistics(gameState: GameState): Promise<void> {
  const username = gameState.username;
  
  if (username) {
    // Increment daily game count for time expired games
    await incrementDailyGameCount(username);
    
    // Save updated statistics
    await updateGameStatistics(username, gameState.statistics);
  }
}