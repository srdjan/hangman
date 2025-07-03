import { createGame, processGuess, getHint } from "../state/game.ts";
import { getSession, setSession, createSession } from "../state/session.ts";
import { homePage, gameComponent } from "../views/home.ts";
import { GameState } from "../types.ts";
import { AuthState } from "../auth/types.ts";
import { Result, ok } from "../utils/result.ts";
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

const getOrCreateGameSession = async (request: Request, authState?: AuthState): Promise<Result<[string, GameState], Error>> => {
  const cookies = request.headers.get("cookie") || "";
  const sessionCookie = cookies
    .split(";")
    .map(c => c.trim())
    .find(c => c.startsWith("hangman_session="));

  let sessionId = sessionCookie?.split("=")[1];
  let gameState: GameState | undefined;

  if (sessionId) {
    gameState = getSession(sessionId);
  }

  if (!sessionId || !gameState) {
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

    gameState = gameResult.value;
    sessionId = createSession(gameState);
  }

  return ok([sessionId, gameState]);
};

export const gameHandler = async (request: Request, _params?: Record<string, string>, authState?: AuthState): Promise<Response> => {
  const sessionResult = await getOrCreateGameSession(request, authState);

  if (!sessionResult.ok) {
    // Check if it's a daily limit error
    if (sessionResult.error.message.startsWith('DAILY_LIMIT_REACHED:')) {
      const parts = sessionResult.error.message.split(':');
      const gamesPlayed = parseInt(parts[1]);
      const gamesRemaining = parseInt(parts[2]);
      
      const { dailyLimitReached, homePage } = await import("../views/home.ts");
      const content = dailyLimitReached(gamesPlayed, gamesRemaining, authState?.username);
      
      return new Response(homePage(content), {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }
    
    return new Response(`Error: ${sessionResult.error.message}`, { status: 500 });
  }

  const [sessionId, gameState] = sessionResult.value;

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
  // Check daily limit before creating new game
  if (authState?.username) {
    try {
      const { checkDailyLimit } = await import("../auth/kv.ts");
      const limitCheck = await checkDailyLimit(authState.username);
      
      if (!limitCheck.canPlay) {
        const { dailyLimitReached, homePage } = await import("../views/home.ts");
        const content = dailyLimitReached(limitCheck.gamesPlayed, limitCheck.gamesRemaining, authState.username);
        
        return new Response(homePage(content), {
          headers: { "Content-Type": "text/html; charset=utf-8" }
        });
      }
    } catch (error) {
      console.error("Error checking daily limit in newGameHandler:", error);
    }
  }

  const sessionResult = await getOrCreateGameSession(request, authState);

  if (!sessionResult.ok) {
    return new Response(`Error: ${sessionResult.error.message}`, { status: 500 });
  }

  const [sessionId, _] = sessionResult.value;

  try {
    // Fixed values - all games are hard difficulty with Words category
    const difficulty: "easy" | "medium" | "hard" = "hard";
    const category = "Words";
    const hintsAllowed = 1;

    const gameResult = await createGame(difficulty, category, hintsAllowed, authState?.username);
    if (!gameResult.ok) {
      return new Response(`Error: ${gameResult.error.message}`, { status: 500 });
    }

    setSession(sessionId, gameResult.value);

    const headers = new Headers({
      "Content-Type": "text/html; charset=utf-8",
      "Set-Cookie": `hangman_session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600`
    });

    return new Response(gameComponent(gameResult.value), { headers });
  } catch (error) {
    console.error("Error in newGameHandler:", error);
    return new Response(`Error: ${error instanceof Error ? error.message : String(error)}`, { status: 500 });
  }
};

/**
 * Handle letter guess request
 */
export const guessHandler = async (request: Request, params: Record<string, string>, authState?: AuthState): Promise<Response> => {
  const letter = params.letter?.toUpperCase() || "";
  if (!/^[A-Z]$/.test(letter)) {
    return new Response("Invalid letter", { status: 400 });
  }

  const sessionResult = await getOrCreateGameSession(request, authState);
  if (!sessionResult.ok) {
    return new Response(`Error: ${sessionResult.error.message}`, { status: 500 });
  }

  const [sessionId, gameState] = sessionResult.value;

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
  const sessionResult = await getOrCreateGameSession(request, authState);
  if (!sessionResult.ok) {
    return new Response(`Error: ${sessionResult.error.message}`, { status: 500 });
  }

  const [sessionId, gameState] = sessionResult.value;

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
  const sessionResult = await getOrCreateGameSession(request, authState);
  if (!sessionResult.ok) {
    return new Response(`Error: ${sessionResult.error.message}`, { status: 500 });
  }

  const [sessionId, gameState] = sessionResult.value;

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
 * Handle standings request
 */
export const standingsHandler = async (request: Request, authState?: AuthState): Promise<Response> => {
  try {
    const { getPlayerStandings } = await import("../auth/kv.ts");
    const { playerStandings, homePage } = await import("../views/home.ts");
    
    const standings = await getPlayerStandings(20); // Top 20 players
    const currentUser = authState?.username;
    
    const standingsComponent = playerStandings(standings, currentUser);
    
    const headers = new Headers({
      "Content-Type": "text/html; charset=utf-8"
    });

    return new Response(homePage(standingsComponent), { headers });
  } catch (error) {
    console.error("Error in standingsHandler:", error);
    return new Response(`Error: ${error instanceof Error ? error.message : String(error)}`, { status: 500 });
  }
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

    // We'll embed the CSS directly if we can't load it from file
    if (filePath === "styles.css") {
      // If this is styles.css and we're in deployment, return hardcoded CSS
      const cssContent = await getStaticCSS();
      return new Response(cssContent, {
        headers: { "Content-Type": "text/css" }
      });
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
    if (filePath === "styles.css") {
      // Last-resort fallback for CSS
      return new Response("/* Fallback CSS */", {
        headers: { "Content-Type": "text/css" }
      });
    }
    return new Response(`Not found: ${filePath}`, { status: 404 });
  }
};

// Function to get CSS content - we'll use this as a fallback
async function getStaticCSS() {
  try {
    // Add paths for single repo structure
    const paths = [
      "./static/styles.css",
      "../static/styles.css",
      `${Deno.cwd()}/src/static/styles.css`,
      `${Deno.cwd()}/static/styles.css`,
      "/static/styles.css"
    ];

    for (const path of paths) {
      try {
        return await Deno.readTextFile(path);
      } catch {
        // Try next path
      }
    }

    // If all paths fail, return a basic fallback CSS
    return `
:root {
  --primary-color: #2c3e50;
  --secondary-color: #3498db;
  --success-color: #2ecc71;
  --danger-color: #e74c3c;
  --text-color: #34495e;
}

body {
  font-family: 'Inter', system-ui, sans-serif;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  margin: 0;
  padding: 2rem;
}

.game-container {
  background: #f8f9fa;
  border-radius: 1rem;
  padding: 0.5rem;
  max-width: 800px;
  margin: 0 auto;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
}

.hangman-display {
  width: 300px;
  margin: 0 auto;
  background: transparent !important;
}

svg {
  width: 100%;
  background: transparent !important;
}

.hangman-part {
  stroke: var(--primary-color);
  stroke-width: 4;
  stroke-linecap: round;
  fill: transparent !important;
}

.word-display {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin: 2rem 0;
  font-size: 2rem;
  letter-spacing: 0.3rem;
}

.letter {
  border-bottom: 4px solid var(--secondary-color);
  min-width: 1em;
  text-align: center;
  text-transform: uppercase;
}

.keyboard {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(40px, 1fr));
  gap: 0.5rem;
  margin-top: 2rem;
}

button {
  padding: 0.8rem;
  border: none;
  border-radius: 0.5rem;
  background: var(--secondary-color);
  color: white;
  cursor: pointer;
}

button:disabled {
  background: #bdc3c7;
  opacity: 0.7;
}

.restart {
  background: var(--success-color);
  grid-column: span 3;
}

.status.win {
  color: var(--success-color);
}

.status.lose {
  color: var(--danger-color);
}
`;
  } catch (error) {
    console.error("Error getting static CSS:", error);
    return "/* Error loading CSS */";
  }
}