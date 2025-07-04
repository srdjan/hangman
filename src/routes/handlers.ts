import { createGame, processGuess, getHint } from "../state/game.ts";
import { getSession, setSession, createSession } from "../state/session.ts";
import { homePage, gameComponent } from "../views/home.ts";
import { GameState } from "../types.ts";
import { AuthState } from "../auth/types.ts";
import { Result, ok, err } from "../utils/result.ts";
// Import categories if needed for validation
// import { categories } from "../data/wordLists.ts";

/**
 * Log successful game completion with timestamp and user info
 */
async function logGameCompletion(gameState: GameState, completionMethod: "guess" | "hint"): Promise<number> {
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

const getGameSession = (request: Request): [string | null, GameState | undefined] => {
  const cookies = request.headers.get("cookie") || "";
  const sessionCookie = cookies
    .split(";")
    .map(c => c.trim())
    .find(c => c.startsWith("hangman_session="));

  const sessionId = sessionCookie?.split("=")[1] || null;
  const gameState = sessionId ? getSession(sessionId) : undefined;

  return [sessionId, gameState];
};

const createNewGameSession = async (authState?: AuthState): Promise<Result<[string, GameState], Error>> => {
  // Check daily limit before creating new game
  if (authState?.username) {
    try {
      const { checkDailyLimit } = await import("../auth/kv.ts");
      const limitCheck = await checkDailyLimit(authState.username);
      
      if (!limitCheck.canPlay) {
        return err(new Error(`DAILY_LIMIT_REACHED:${limitCheck.gamesPlayed}:${limitCheck.gamesRemaining}`));
      }
    } catch (error) {
      console.error("Error checking daily limit:", error);
      // Continue without limit check if there's an error
    }
  }

  const gameResult = await createGame("hard", "Words", 1, authState?.username);
  if (!gameResult.ok) {
    return gameResult;
  }

  const gameState = gameResult.value;
  const sessionId = createSession(gameState);

  return ok([sessionId, gameState]);
};

export const gameHandler = async (request: Request, _params?: Record<string, string>, authState?: AuthState): Promise<Response> => {
  const [sessionId, gameState] = getGameSession(request);

  // If there's no active game, show welcome screen
  if (!sessionId || !gameState) {
    const { welcomeScreen, homePage } = await import("../views/home.ts");
    const content = welcomeScreen(authState?.username);
    
    return new Response(homePage(content), {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Set-Cookie": `hangman_session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600`
  });

  const content = gameComponent(gameState);
  return new Response(homePage(content), { headers });
};

/**
 * Handle new game creation request
 */
export const newGameHandler = async (request: Request, authState?: AuthState): Promise<Response> => {
  const sessionResult = await createNewGameSession(authState);

  if (!sessionResult.ok) {
    // Check if it's a daily limit error
    if (sessionResult.error.message.startsWith('DAILY_LIMIT_REACHED:')) {
      const parts = sessionResult.error.message.split(':');
      const gamesPlayed = parseInt(parts[1]);
      const gamesRemaining = parseInt(parts[2]);
      
      // Check if this is an HTMX request
      const isHtmxRequest = request.headers.get('HX-Request') === 'true';
      
      if (isHtmxRequest) {
        // For HTMX requests, return the component wrapped in game-container div
        const { dailyLimitReached } = await import("../views/home.ts");
        const content = dailyLimitReached(gamesPlayed, gamesRemaining, authState?.username);
        
        const wrappedContent = `<div class="game-container" id="game-container">${content}</div>`;
        
        return new Response(wrappedContent, {
          headers: { "Content-Type": "text/html; charset=utf-8" }
        });
      } else {
        // For full page requests, return the complete page
        const { dailyLimitReachedPage } = await import("../views/home.ts");
        const pageContent = dailyLimitReachedPage(gamesPlayed, gamesRemaining, authState?.username);
        
        return new Response(pageContent, {
          headers: { "Content-Type": "text/html; charset=utf-8" }
        });
      }
    }
    
    return new Response(`Error: ${sessionResult.error.message}`, { status: 500 });
  }

  const [sessionId, gameState] = sessionResult.value;

  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Set-Cookie": `hangman_session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600`
  });

  return new Response(gameComponent(gameState), { headers });
};

/**
 * Handle letter guess request
 */
export const guessHandler = async (request: Request, params: Record<string, string>, authState?: AuthState): Promise<Response> => {
  const letter = params.letter?.toUpperCase() || "";
  if (!/^[A-Z]$/.test(letter)) {
    return new Response("Invalid letter", { status: 400 });
  }

  const [sessionId, gameState] = getGameSession(request);
  if (!sessionId || !gameState) {
    return new Response("No active game", { status: 400 });
  }

  // Check if time has expired before processing guess
  const { checkTimeExpired, createTimeExpiredState } = await import("../state/game.ts");
  if (checkTimeExpired(gameState)) {
    const timeExpiredState = createTimeExpiredState(gameState);
    
    // Save updated statistics if user is authenticated
    if (timeExpiredState.username) {
      try {
        const { updateUserStatistics } = await import("../auth/kv.ts");
        await updateUserStatistics(timeExpiredState.username, timeExpiredState.statistics);
      } catch (error) {
        console.error("Failed to save user statistics:", error);
      }
    }
    
    setSession(sessionId, timeExpiredState);
    const headers = new Headers({
      "Content-Type": "text/html; charset=utf-8",
      "Set-Cookie": `hangman_session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600`
    });
    return new Response(gameComponent(timeExpiredState), { headers });
  }

  // Process the guess and update the session
  const updatedStateResult = processGuess(gameState, letter);

  if (!updatedStateResult.ok) {
    return new Response(`Error: ${updatedStateResult.error.message}`, { status: 500 });
  }

  const updatedState = updatedStateResult.value;

  // Log successful game completion and save statistics
  if (gameState.status === "playing" && (updatedState.status === "won" || updatedState.status === "lost")) {
    // Increment daily game count for completed games
    if (updatedState.username) {
      try {
        const { incrementDailyGameCount } = await import("../auth/kv.ts");
        await incrementDailyGameCount(updatedState.username);
      } catch (error) {
        console.error("Failed to increment daily game count:", error);
      }
    }

    if (updatedState.status === "won") {
      const sequenceNumber = await logGameCompletion(updatedState, "guess");
      // Add sequence number to the updated state for display
      updatedState.winSequenceNumber = sequenceNumber;
      
      // Update player standings for wins
      if (updatedState.username && updatedState.endTime) {
        try {
          const gameTimeSeconds = Math.round((updatedState.endTime - updatedState.startTime) / 1000);
          const { updatePlayerStanding } = await import("../auth/kv.ts");
          await updatePlayerStanding(updatedState.username, gameTimeSeconds);
        } catch (error) {
          console.error("Failed to update player standings:", error);
        }
      }
    }
    
    // Save updated statistics to persistent storage if user is authenticated
    if (updatedState.username) {
      try {
        const { updateUserStatistics } = await import("../auth/kv.ts");
        await updateUserStatistics(updatedState.username, updatedState.statistics);
      } catch (error) {
        console.error("Failed to save user statistics:", error);
      }
    }
  }

  setSession(sessionId, updatedState);

  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Set-Cookie": `hangman_session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600`
  });

  return new Response(gameComponent(updatedState), { headers });
};

/**
 * Handle hint request
 */
export const hintHandler = async (request: Request, authState?: AuthState): Promise<Response> => {
  const [sessionId, gameState] = getGameSession(request);
  if (!sessionId || !gameState) {
    return new Response("No active game", { status: 400 });
  }

  // Check if time has expired before processing hint
  const { checkTimeExpired, createTimeExpiredState } = await import("../state/game.ts");
  if (checkTimeExpired(gameState)) {
    const timeExpiredState = createTimeExpiredState(gameState);
    
    // Save updated statistics if user is authenticated
    if (timeExpiredState.username) {
      try {
        const { updateUserStatistics } = await import("../auth/kv.ts");
        await updateUserStatistics(timeExpiredState.username, timeExpiredState.statistics);
      } catch (error) {
        console.error("Failed to save user statistics:", error);
      }
    }
    
    setSession(sessionId, timeExpiredState);
    const headers = new Headers({
      "Content-Type": "text/html; charset=utf-8",
      "Set-Cookie": `hangman_session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600`
    });
    return new Response(gameComponent(timeExpiredState), { headers });
  }

  // Process the hint and update the session
  const updatedStateResult = getHint(gameState);

  if (!updatedStateResult.ok) {
    return new Response(`Error: ${updatedStateResult.error.message}`, { status: 500 });
  }

  const updatedState = updatedStateResult.value;

  // Log successful game completion and save statistics
  if (gameState.status === "playing" && (updatedState.status === "won" || updatedState.status === "lost")) {
    // Increment daily game count for completed games
    if (updatedState.username) {
      try {
        const { incrementDailyGameCount } = await import("../auth/kv.ts");
        await incrementDailyGameCount(updatedState.username);
      } catch (error) {
        console.error("Failed to increment daily game count:", error);
      }
    }

    if (updatedState.status === "won") {
      const sequenceNumber = await logGameCompletion(updatedState, "hint");
      // Add sequence number to the updated state for display
      updatedState.winSequenceNumber = sequenceNumber;
      
      // Update player standings for wins
      if (updatedState.username && updatedState.endTime) {
        try {
          const gameTimeSeconds = Math.round((updatedState.endTime - updatedState.startTime) / 1000);
          const { updatePlayerStanding } = await import("../auth/kv.ts");
          await updatePlayerStanding(updatedState.username, gameTimeSeconds);
        } catch (error) {
          console.error("Failed to update player standings:", error);
        }
      }
    }
    
    // Save updated statistics to persistent storage if user is authenticated
    if (updatedState.username) {
      try {
        const { updateUserStatistics } = await import("../auth/kv.ts");
        await updateUserStatistics(updatedState.username, updatedState.statistics);
      } catch (error) {
        console.error("Failed to save user statistics:", error);
      }
    }
  }

  setSession(sessionId, updatedState);

  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Set-Cookie": `hangman_session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600`
  });

  return new Response(gameComponent(updatedState), { headers });
};

/**
 * Handle time expired request
 */
export const timeExpiredHandler = async (request: Request, authState?: AuthState): Promise<Response> => {
  const [sessionId, gameState] = getGameSession(request);
  if (!sessionId || !gameState) {
    return new Response("No active game", { status: 400 });
  }

  // Check if game is still playing and time has actually expired
  if (gameState.status !== "playing") {
    // Game already ended, just return current state
    return new Response(gameComponent(gameState), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Set-Cookie": `hangman_session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600`
      }
    });
  }

  const { checkTimeExpired, createTimeExpiredState } = await import("../state/game.ts");
  
  if (!checkTimeExpired(gameState)) {
    // Time hasn't actually expired yet, return current state
    return new Response(gameComponent(gameState), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Set-Cookie": `hangman_session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600`
      }
    });
  }

  // Create time expired state
  const updatedState = createTimeExpiredState(gameState);

  // Increment daily game count for time expired games
  if (updatedState.username) {
    try {
      const { incrementDailyGameCount } = await import("../auth/kv.ts");
      await incrementDailyGameCount(updatedState.username);
    } catch (error) {
      console.error("Failed to increment daily game count:", error);
    }
  }

  // Save updated statistics to persistent storage if user is authenticated
  if (updatedState.username) {
    try {
      const { updateUserStatistics } = await import("../auth/kv.ts");
      await updateUserStatistics(updatedState.username, updatedState.statistics);
    } catch (error) {
      console.error("Failed to save user statistics:", error);
    }
  }

  setSession(sessionId, updatedState);

  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Set-Cookie": `hangman_session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600`
  });

  return new Response(gameComponent(updatedState), { headers });
};


/**
 * Handle daily limit info API request
 */
export const dailyLimitInfoHandler = async (request: Request, authState?: AuthState): Promise<Response> => {
  if (!authState?.username) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const { checkDailyLimit } = await import("../auth/kv.ts");
    const limitCheck = await checkDailyLimit(authState.username);
    
    return new Response(JSON.stringify({
      gamesPlayed: limitCheck.gamesPlayed,
      gamesRemaining: limitCheck.gamesRemaining,
      canPlay: limitCheck.canPlay
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error in dailyLimitInfoHandler:", error);
    return new Response(JSON.stringify({ error: "Failed to get limit info" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

/**
 * Handle standings API request
 */
export const standingsApiHandler = async (request: Request, authState?: AuthState): Promise<Response> => {
  try {
    const { getPlayerStandings } = await import("../auth/kv.ts");
    const { playerStandingsContent } = await import("../views/home.ts");
    
    const standings = await getPlayerStandings(20); // Top 20 players
    const currentUser = authState?.username;
    
    const content = playerStandingsContent(standings, currentUser);
    
    return new Response(JSON.stringify({
      standings: standings.length,
      content: content
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error in standingsApiHandler:", error);
    return new Response(JSON.stringify({ error: "Failed to get standings" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

/**
 * Handle user stats API request
 */
export const userStatsApiHandler = async (request: Request, authState?: AuthState): Promise<Response> => {
  if (!authState?.username) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const { getUserStatistics } = await import("../auth/kv.ts");
    const { gameStatsContent } = await import("../views/home.ts");
    
    const statistics = await getUserStatistics(authState.username);
    
    // Create a minimal game state object for the stats display
    const mockGameState = {
      statistics,
      username: authState.username,
      status: "not_playing" as const,
      startTime: 0,
      endTime: 0,
      timeLimit: 60
    };
    
    const content = gameStatsContent(mockGameState);
    
    return new Response(JSON.stringify({
      stats: true,
      content: content
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error in userStatsApiHandler:", error);
    return new Response(JSON.stringify({ error: "Failed to get user stats" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

/**
 * Handle static file requests
 */
export const staticFileHandler = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const filePath = url.pathname.replace(/^\/static\//, "");

  try {
    // Set content type based on file extension
    let contentType;
    if (filePath.endsWith(".css")) {
      contentType = "text/css";
    } else if (filePath.endsWith(".js")) {
      contentType = "text/javascript";
    } else {
      contentType = "application/octet-stream";
    }


    // For other files, try different paths
    let contents;
    let foundPath = null;

    try {
      // Try direct path (works in deployment when using cd to app dir)
      const directPath = `./static/${filePath}`;
      contents = filePath.endsWith(".css") || filePath.endsWith(".js")
        ? await Deno.readTextFile(directPath)
        : await Deno.readFile(directPath);
      foundPath = directPath;
    } catch (directError) {
      try {
        // Try relative to module
        const modulePath = new URL(`../static/${filePath}`, import.meta.url).pathname;
        contents = filePath.endsWith(".css") || filePath.endsWith(".js")
          ? await Deno.readTextFile(modulePath)
          : await Deno.readFile(modulePath);
        foundPath = modulePath;
      } catch (_moduleError) {
        try {
          // Try src/static path
          const cwd = Deno.cwd();
          const srcPath = `${cwd}/src/static/${filePath}`;
          contents = filePath.endsWith(".css") || filePath.endsWith(".js")
            ? await Deno.readTextFile(srcPath)
            : await Deno.readFile(srcPath);
          foundPath = srcPath;
        } catch (_cwdError) {
          console.error(`All file loading attempts failed for ${filePath}`);
          throw directError;
        }
      }
    }

    console.log(`Successfully loaded from: ${foundPath}`);
    return new Response(contents, {
      headers: { "Content-Type": contentType }
    });
  } catch (error) {
    console.error(`Failed to load static file: ${filePath}`, error);
    return new Response(`Not found: ${filePath}`, { status: 404 });
  }
};

