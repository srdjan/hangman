import { createGame, processGuess, getHint } from "../state/game.ts";
import { createSession } from "../state/session.ts";
import { homePage, gameComponent } from "../views/home.ts";
import { GameState } from "../types.ts";
import { AuthState } from "../auth/types.ts";
import { Result, ok, err } from "../utils/result.ts";
import { getGameSession, updateGameSession, createSessionHeaders, isValidSession } from "../utils/session.ts";
import { createHtmlResponse, createHtmlResponseWithSession, createJsonResponse, createErrorResponse, createStaticResponse } from "../utils/http.ts";
import { handleGameCompletion, handleTimeExpiredStatistics } from "../utils/statistics.ts";
import { logError, logWarning, LogContext, GameLogger } from "../utils/logger.ts";
import { GAME_CONFIG, HTTP_STATUS, MESSAGES, REGEX_PATTERNS } from "../constants.ts";
// Import categories if needed for validation
// import { categories } from "../data/wordLists.ts";



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
      logError(LogContext.GAME, error as Error, { 
        operation: 'check_daily_limit', 
        username: authState.username 
      });
      // Continue without limit check if there's an error
    }
  }

  const gameResult = await createGame(
    GAME_CONFIG.DEFAULT_DIFFICULTY, 
    GAME_CONFIG.DEFAULT_CATEGORY, 
    GAME_CONFIG.DEFAULT_WORD_COUNT, 
    authState?.username
  );
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
  if (!isValidSession(sessionId, gameState)) {
    const { welcomeScreen, homePage } = await import("../views/home.ts");
    const content = welcomeScreen(authState?.username);
    
    return createHtmlResponse(homePage(content));
  }

  const content = gameComponent(gameState);
  return createHtmlResponseWithSession(homePage(content), sessionId);
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
        
        return createHtmlResponse(wrappedContent);
      } else {
        // For full page requests, return the complete page
        const { dailyLimitReachedPage } = await import("../views/home.ts");
        const pageContent = dailyLimitReachedPage(gamesPlayed, gamesRemaining, authState?.username);
        
        return createHtmlResponse(pageContent);
      }
    }
    
    return createErrorResponse(sessionResult.error.message, 500);
  }

  const [sessionId, gameState] = sessionResult.value;

  return createHtmlResponseWithSession(gameComponent(gameState), sessionId);
};

/**
 * Handle letter guess request
 */
export const guessHandler = async (request: Request, params: Record<string, string>, authState?: AuthState): Promise<Response> => {
  const letter = params.letter?.toUpperCase() || "";
  if (!REGEX_PATTERNS.LETTER.test(letter)) {
    return createErrorResponse(MESSAGES.INVALID_LETTER, HTTP_STATUS.BAD_REQUEST);
  }

  const [sessionId, gameState] = getGameSession(request);
  if (!isValidSession(sessionId, gameState)) {
    return createErrorResponse(MESSAGES.NO_ACTIVE_GAME, HTTP_STATUS.BAD_REQUEST);
  }

  // Check if time has expired before processing guess
  const { checkTimeExpired, createTimeExpiredState } = await import("../state/game.ts");
  if (checkTimeExpired(gameState)) {
    const timeExpiredState = createTimeExpiredState(gameState);
    
    // Handle time expired statistics
    await handleTimeExpiredStatistics(timeExpiredState);
    
    updateGameSession(sessionId, timeExpiredState);
    return createHtmlResponseWithSession(gameComponent(timeExpiredState), sessionId);
  }

  // Process the guess and update the session
  const updatedStateResult = processGuess(gameState, letter);

  if (!updatedStateResult.ok) {
    return createErrorResponse(updatedStateResult.error.message, 500);
  }

  const updatedState = updatedStateResult.value;

  // Handle game completion statistics
  if (gameState.status === "playing" && (updatedState.status === "won" || updatedState.status === "lost")) {
    await handleGameCompletion(updatedState, "guess");
  }

  updateGameSession(sessionId, updatedState);

  return createHtmlResponseWithSession(gameComponent(updatedState), sessionId);
};

/**
 * Handle hint request
 */
export const hintHandler = async (request: Request, authState?: AuthState): Promise<Response> => {
  const [sessionId, gameState] = getGameSession(request);
  if (!isValidSession(sessionId, gameState)) {
    return createErrorResponse(MESSAGES.NO_ACTIVE_GAME, HTTP_STATUS.BAD_REQUEST);
  }

  // Check if time has expired before processing hint
  const { checkTimeExpired, createTimeExpiredState } = await import("../state/game.ts");
  if (checkTimeExpired(gameState)) {
    const timeExpiredState = createTimeExpiredState(gameState);
    
    // Handle time expired statistics
    await handleTimeExpiredStatistics(timeExpiredState);
    
    updateGameSession(sessionId, timeExpiredState);
    return createHtmlResponseWithSession(gameComponent(timeExpiredState), sessionId);
  }

  // Process the hint and update the session
  const updatedStateResult = getHint(gameState);

  if (!updatedStateResult.ok) {
    return new Response(`Error: ${updatedStateResult.error.message}`, { status: 500 });
  }

  const updatedState = updatedStateResult.value;

  // Handle game completion statistics
  if (gameState.status === "playing" && (updatedState.status === "won" || updatedState.status === "lost")) {
    await handleGameCompletion(updatedState, "hint");
  }

  updateGameSession(sessionId, updatedState);

  return createHtmlResponseWithSession(gameComponent(updatedState), sessionId);
};

/**
 * Handle time expired request
 */
export const timeExpiredHandler = async (request: Request, authState?: AuthState): Promise<Response> => {
  const [sessionId, gameState] = getGameSession(request);
  if (!isValidSession(sessionId, gameState)) {
    return createErrorResponse(MESSAGES.NO_ACTIVE_GAME, HTTP_STATUS.BAD_REQUEST);
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

  // Handle time expired statistics
  await handleTimeExpiredStatistics(updatedState);

  updateGameSession(sessionId, updatedState);

  return createHtmlResponseWithSession(gameComponent(updatedState), sessionId);
};


/**
 * Handle daily limit info API request
 */
export const dailyLimitInfoHandler = async (request: Request, authState?: AuthState): Promise<Response> => {
  if (!authState?.username) {
    return createJsonResponse({ error: "Not authenticated" }, 401);
  }

  try {
    const { checkDailyLimit } = await import("../auth/kv.ts");
    const limitCheck = await checkDailyLimit(authState.username);
    
    return createJsonResponse({
      gamesPlayed: limitCheck.gamesPlayed,
      gamesRemaining: limitCheck.gamesRemaining,
      canPlay: limitCheck.canPlay
    });
  } catch (error) {
    logError(LogContext.API, error as Error, { 
      operation: 'get_daily_limit_info', 
      username: authState?.username 
    });
    return createJsonResponse({ error: "Failed to get limit info" }, 500);
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
    const currentUser = authState?.username || null;
    
    const content = playerStandingsContent(standings, currentUser);
    
    return createJsonResponse({
      standings: standings.length,
      content: content
    });
  } catch (error) {
    logError(LogContext.API, error as Error, { 
      operation: 'get_standings', 
      username: authState?.username 
    });
    return createJsonResponse({ error: "Failed to get standings" }, 500);
  }
};

/**
 * Handle user stats API request
 */
export const userStatsApiHandler = async (request: Request, authState?: AuthState): Promise<Response> => {
  if (!authState?.username) {
    return createJsonResponse({ error: "Not authenticated" }, 401);
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
    
    return createJsonResponse({
      stats: true,
      content: content
    });
  } catch (error) {
    logError(LogContext.API, error as Error, { 
      operation: 'get_user_stats', 
      username: authState?.username 
    });
    return createJsonResponse({ error: "Failed to get user stats" }, 500);
  }
};

/**
 * Handle static file requests
 */
export const staticFileHandler = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const filePath = url.pathname.replace(/^\/static\//, "");

  try {


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
    return createStaticResponse(contents, filePath);
  } catch (error) {
    logError(LogContext.STATIC, error as Error, { 
      operation: 'load_static_file', 
      filePath 
    });
    return createErrorResponse(`Not found: ${filePath}`, 404);
  }
};

