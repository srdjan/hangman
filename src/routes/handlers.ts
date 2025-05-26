import { createGame, processGuess, getHint, createTwoPlayerGame, processTwoPlayerGuess } from "../state/game.ts";
import { getSession, setSession, createSession } from "../state/session.ts";
import { createGameRoom, joinGameRoom, getGameRoom, updateRoomGameState, addSSEConnection, removeSSEConnection, broadcastToRoom } from "../state/rooms.ts";
import { homePage, gameComponent, twoPlayerGameComponent, gameModeSelector, twoPlayerSetupComponent, roomWaitingComponent, twoPlayerGameComponentWithInvitation } from "../views/home.ts";
import { GameState, TwoPlayerGameState, WordDifficulty, GameRoom, SSEMessage } from "../types.ts";
import { Result, ok } from "../utils/result.ts";
// Import categories if needed for validation
// import { categories } from "../data/wordLists.ts";

const getOrCreateGameSession = (request: Request): Result<[string, GameState]> => {
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
    const gameResult = createGame();
    if (!gameResult.ok) {
      return gameResult;
    }

    gameState = gameResult.value;
    sessionId = createSession(gameState);
  }

  return ok([sessionId, gameState]);
};

export const gameHandler = (request: Request): Promise<Response> => {
  // Check if this is a request for a specific game mode
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");

  if (mode === "single") {
    // Start single player game
    const sessionResult = getOrCreateGameSession(request);

    if (!sessionResult.ok) {
      return Promise.resolve(new Response(`Error: ${sessionResult.error.message}`, { status: 500 }));
    }

    const [sessionId, gameState] = sessionResult.value;

    const headers = new Headers({
      "Content-Type": "text/html; charset=utf-8",
      "Set-Cookie": `hangman_session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600`
    });

    const content = gameComponent(gameState);
    return Promise.resolve(new Response(homePage(content), { headers }));
  } else {
    // Show game mode selector by default
    const content = gameModeSelector();
    const headers = new Headers({
      "Content-Type": "text/html; charset=utf-8"
    });
    return Promise.resolve(new Response(homePage(content), { headers }));
  }
};

/**
 * Handle new game creation request
 */
export const newGameHandler = async (request: Request): Promise<Response> => {
  const sessionResult = getOrCreateGameSession(request);

  if (!sessionResult.ok) {
    return Promise.resolve(new Response(`Error: ${sessionResult.error.message}`, { status: 500 }));
  }

  const [sessionId, _] = sessionResult.value;

  try {
    // Default values
    let difficulty: "easy" | "medium" | "hard" = "medium";
    let category = "General";
    let hintsAllowed = 1;

    // Check for URL parameters first
    const url = new URL(request.url);
    const difficultyParam = url.searchParams.get("difficulty");
    if (difficultyParam === "easy" || difficultyParam === "medium" || difficultyParam === "hard") {
      difficulty = difficultyParam;
    }

    const categoryParam = url.searchParams.get("category");
    if (categoryParam) {
      category = categoryParam;
    }

    const hintsParam = url.searchParams.get("hintsAllowed");
    if (hintsParam) {
      hintsAllowed = parseInt(hintsParam, 10) || 1;
    }

    // If no URL parameters, check for form data or JSON
    if (!url.searchParams.has("difficulty") && !url.searchParams.has("category")) {
      const contentType = request.headers.get("Content-Type");

      try {
        if (contentType && contentType.includes("application/json")) {
          // From pill buttons using hx-vals
          const jsonData = await request.json();
          if (jsonData.difficulty &&
            (jsonData.difficulty === "easy" ||
              jsonData.difficulty === "medium" ||
              jsonData.difficulty === "hard")) {
            difficulty = jsonData.difficulty as "easy" | "medium" | "hard";
          }
          if (jsonData.category) {
            category = jsonData.category;
          }
          if (jsonData.hintsAllowed !== undefined) {
            hintsAllowed = parseInt(jsonData.hintsAllowed.toString(), 10) || 1;
          }
        } else {
          // From traditional form data
          const formData = await request.formData();
          const difficultyValue = formData.get("difficulty");
          if (difficultyValue === "easy" ||
            difficultyValue === "medium" ||
            difficultyValue === "hard") {
            difficulty = difficultyValue as "easy" | "medium" | "hard";
          }

          const categoryValue = formData.get("category");
          if (categoryValue) {
            category = categoryValue.toString();
          }

          const hintsValue = formData.get("hintsAllowed");
          if (hintsValue) {
            hintsAllowed = parseInt(hintsValue.toString(), 10) || 1;
          }
        }
      } catch (_error) {
        // If there's an error parsing the request body, use the defaults
        console.log("Error parsing request body, using default values");
      }
    }

    const gameResult = createGame(difficulty, category, hintsAllowed);
    if (!gameResult.ok) {
      return Promise.resolve(new Response(`Error: ${gameResult.error.message}`, { status: 500 }));
    }

    setSession(sessionId, gameResult.value);

    const headers = new Headers({
      "Content-Type": "text/html; charset=utf-8",
      "Set-Cookie": `hangman_session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600`
    });

    return Promise.resolve(new Response(gameComponent(gameResult.value), { headers }));
  } catch (error) {
    console.error("Error in newGameHandler:", error);
    return Promise.resolve(new Response(`Error: ${error instanceof Error ? error.message : String(error)}`, { status: 500 }));
  }
};

/**
 * Handle letter guess request
 */
export const guessHandler = (request: Request, params: Record<string, string>): Promise<Response> => {
  const letter = params.letter?.toUpperCase() || "";
  if (!/^[A-Z]$/.test(letter)) {
    return Promise.resolve(new Response("Invalid letter", { status: 400 }));
  }

  const sessionResult = getOrCreateGameSession(request);
  if (!sessionResult.ok) {
    return Promise.resolve(new Response(`Error: ${sessionResult.error.message}`, { status: 500 }));
  }

  const [sessionId, gameState] = sessionResult.value;

  // Get category and difficulty from URL parameters if available
  let category = gameState.category;
  let difficulty = gameState.difficulty;

  // Parse URL parameters
  const url = new URL(request.url);
  const categoryParam = url.searchParams.get("category");
  if (categoryParam) {
    category = categoryParam;
  }

  const difficultyParam = url.searchParams.get("difficulty");
  if (difficultyParam === "easy" || difficultyParam === "medium" || difficultyParam === "hard") {
    difficulty = difficultyParam as "easy" | "medium" | "hard";
  }

  // Update the game state with the current category and difficulty
  const updatedGameState = {
    ...gameState,
    category,
    difficulty
  };

  // Process the guess and update the session
  const updatedStateResult = processGuess(updatedGameState, letter);

  if (!updatedStateResult.ok) {
    return Promise.resolve(new Response(`Error: ${updatedStateResult.error.message}`, { status: 500 }));
  }

  setSession(sessionId, updatedStateResult.value);

  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Set-Cookie": `hangman_session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600`
  });

  return Promise.resolve(new Response(gameComponent(updatedStateResult.value), { headers }));
};

/**
 * Handle hint request
 */
export const hintHandler = (request: Request): Promise<Response> => {
  const sessionResult = getOrCreateGameSession(request);
  if (!sessionResult.ok) {
    return Promise.resolve(new Response(`Error: ${sessionResult.error.message}`, { status: 500 }));
  }

  const [sessionId, gameState] = sessionResult.value;

  // Get category and difficulty from URL parameters if available
  let category = gameState.category;
  let difficulty = gameState.difficulty;

  // Parse URL parameters
  const url = new URL(request.url);
  const categoryParam = url.searchParams.get("category");
  if (categoryParam) {
    category = categoryParam;
  }

  const difficultyParam = url.searchParams.get("difficulty");
  if (difficultyParam === "easy" || difficultyParam === "medium" || difficultyParam === "hard") {
    difficulty = difficultyParam as "easy" | "medium" | "hard";
  }

  // Update the game state with the current category and difficulty
  const updatedGameState = {
    ...gameState,
    category,
    difficulty
  };

  // Process the hint and update the session
  const updatedStateResult = getHint(updatedGameState);

  if (!updatedStateResult.ok) {
    return Promise.resolve(new Response(`Error: ${updatedStateResult.error.message}`, { status: 500 }));
  }

  setSession(sessionId, updatedStateResult.value);

  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Set-Cookie": `hangman_session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600`
  });

  return Promise.resolve(new Response(gameComponent(updatedStateResult.value), { headers }));
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

/**
 * Helper function to get or create two-player game session
 */
const getOrCreateTwoPlayerGameSession = (request: Request): Result<[string, TwoPlayerGameState]> => {
  const cookies = request.headers.get("cookie") || "";
  const sessionCookie = cookies
    .split(";")
    .map(c => c.trim())
    .find(c => c.startsWith("hangman_two_player_session="));

  let sessionId = sessionCookie?.split("=")[1];
  let gameState: TwoPlayerGameState | undefined;

  if (sessionId) {
    const sessionData = getSession(sessionId);
    // Check if it's a two-player game state by checking for specific properties
    if (sessionData &&
      typeof sessionData === 'object' &&
      'player1' in sessionData &&
      'player2' in sessionData &&
      'currentTurn' in sessionData &&
      'gameStatus' in sessionData) {
      gameState = sessionData as unknown as TwoPlayerGameState;
    }
  }

  if (!sessionId || !gameState) {
    const gameResult = createTwoPlayerGame();
    if (!gameResult.ok) {
      return gameResult;
    }

    gameState = gameResult.value;
    sessionId = createSession(gameState as unknown as GameState); // Type assertion needed for session storage
  }

  return ok([sessionId, gameState]);
};

/**
 * Handle two-player setup page
 */
export const twoPlayerSetupHandler = (_request: Request): Promise<Response> => {
  const content = twoPlayerSetupComponent();
  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8"
  });
  return Promise.resolve(new Response(homePage(content), { headers }));
};

/**
 * Handle room creation requests
 */
export const createRoomHandler = (request: Request): Promise<Response> => {
  try {
    // Parse form data from request body
    return request.text().then(body => {
      const params = new URLSearchParams(body);
      const playerName = params.get("playerName") || "Player 1";
      // Store difficulty and category for later use when starting the game
      const _difficulty = params.get("difficulty") as WordDifficulty || "medium";
      const _category = params.get("category") || "General";

      const playerId = crypto.randomUUID();
      const roomResult = createGameRoom(playerId, playerName);

      if (!roomResult.ok) {
        return new Response(`Error: ${roomResult.error.message}`, { status: 500 });
      }

      const room = roomResult.value;

      // Set player session cookie and redirect directly to the game room
      const headers = new Headers({
        "Content-Type": "text/html; charset=utf-8",
        "Set-Cookie": `hangman_player_id=${playerId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600`,
        "Location": `/room/${room.id}/game`
      });

      return new Response("", { status: 302, headers });
    });
  } catch (error) {
    console.error("Error in createRoomHandler:", error);
    return Promise.resolve(new Response(`Error: ${error instanceof Error ? error.message : String(error)}`, { status: 500 }));
  }
};

/**
 * Handle two-player guess requests
 */
export const twoPlayerGuessHandler = (request: Request, params: Record<string, string>): Promise<Response> => {
  try {
    const letter = params.letter?.toUpperCase();
    if (!letter) {
      return Promise.resolve(new Response("No letter provided", { status: 400 }));
    }

    // Get session from cookies
    const cookies = request.headers.get("cookie") || "";
    const sessionCookie = cookies
      .split(";")
      .map(c => c.trim())
      .find(c => c.startsWith("hangman_two_player_session="));

    const sessionId = sessionCookie?.split("=")[1];
    if (!sessionId) {
      return Promise.resolve(new Response("No session found", { status: 400 }));
    }

    const sessionData = getSession(sessionId);
    if (!sessionData ||
      !('player1' in sessionData) ||
      !('player2' in sessionData) ||
      !('currentTurn' in sessionData)) {
      return Promise.resolve(new Response("Invalid session", { status: 400 }));
    }

    const gameState = sessionData as unknown as TwoPlayerGameState;

    // Process the guess and update the session
    const updatedStateResult = processTwoPlayerGuess(gameState, letter);

    if (!updatedStateResult.ok) {
      return Promise.resolve(new Response(`Error: ${updatedStateResult.error.message}`, { status: 500 }));
    }

    setSession(sessionId, updatedStateResult.value as unknown as GameState);

    const headers = new Headers({
      "Content-Type": "text/html; charset=utf-8",
      "Set-Cookie": `hangman_two_player_session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600`
    });

    return Promise.resolve(new Response(twoPlayerGameComponent(updatedStateResult.value, ""), { headers }));
  } catch (error) {
    console.error("Error in twoPlayerGuessHandler:", error);
    return Promise.resolve(new Response(`Error: ${error instanceof Error ? error.message : String(error)}`, { status: 500 }));
  }
};

/**
 * Handle room join requests
 */
export const joinRoomHandler = (request: Request): Promise<Response> => {
  try {
    return request.text().then(body => {
      const params = new URLSearchParams(body);
      const playerName = params.get("playerName") || "Player 2";
      const roomId = params.get("roomId");

      if (!roomId) {
        return new Response("Room ID is required", { status: 400 });
      }

      const playerId = crypto.randomUUID();
      const joinResult = joinGameRoom(roomId, playerId, playerName);

      if (!joinResult.ok) {
        return new Response(`Error: ${joinResult.error.message}`, { status: 400 });
      }

      const room = joinResult.value;

      // Create the two-player game now that both players are present
      if (room.player1 && room.player2) {
        const gameResult = createTwoPlayerGame(
          roomId,
          room.player1.name,
          room.player2.name,
          "medium", // Default difficulty for now
          "General", // Default category for now
          1 // Default hints
        );

        if (gameResult.ok) {
          updateRoomGameState(roomId, gameResult.value);

          // Broadcast to Player 1 that Player 2 has joined
          broadcastToRoom(roomId, {
            type: "playerJoined",
            playerName: room.player2.name
          });
        }
      }

      // Set player session cookie
      const headers = new Headers({
        "Content-Type": "text/html; charset=utf-8",
        "Set-Cookie": `hangman_player_id=${playerId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600`
      });

      // Redirect to the game
      return new Response("", {
        status: 302,
        headers: {
          ...headers,
          "Location": `/room/${roomId}/game`
        }
      });
    });
  } catch (error) {
    console.error("Error in joinRoomHandler:", error);
    return Promise.resolve(new Response(`Error: ${error instanceof Error ? error.message : String(error)}`, { status: 500 }));
  }
};

/**
 * Handle SSE connections for real-time updates
 */
export const roomEventsHandler = (request: Request, params: Record<string, string>): Promise<Response> => {
  const roomId = params.roomId;
  if (!roomId) {
    return Promise.resolve(new Response("Room ID required", { status: 400 }));
  }

  // Get player ID from cookies
  const cookies = request.headers.get("cookie") || "";
  const playerCookie = cookies
    .split(";")
    .map(c => c.trim())
    .find(c => c.startsWith("hangman_player_id="));

  const playerId = playerCookie?.split("=")[1];
  if (!playerId) {
    return Promise.resolve(new Response("Player ID required", { status: 400 }));
  }

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      // Add this connection to the room
      addSSEConnection(roomId, playerId, controller);

      // Send initial connection message
      const message = `data: ${JSON.stringify({ type: "connected" })}\n\n`;
      controller.enqueue(new TextEncoder().encode(message));
    },
    cancel() {
      // Remove connection when client disconnects
      removeSSEConnection(roomId, playerId);
    }
  });

  return Promise.resolve(new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control"
    }
  }));
};

/**
 * Handle invitation link access - show join form for the specific room
 */
export const roomInvitationHandler = (_request: Request, params: Record<string, string>): Promise<Response> => {
  const roomId = params.roomId;
  if (!roomId) {
    return Promise.resolve(new Response("Room ID required", { status: 400 }));
  }

  const room = getGameRoom(roomId);
  if (!room) {
    const content = `
    <div class="error-container" id="game-container">
      <div class="error-header">
        <h2>Room Not Found</h2>
        <p>The game room you're looking for doesn't exist or has expired.</p>
      </div>
      <div class="error-actions">
        <button class="back-button" hx-get="/" hx-target="#game-container" hx-swap="outerHTML">
          ← Back to Game Modes
        </button>
      </div>
    </div>
    `;

    const headers = new Headers({
      "Content-Type": "text/html; charset=utf-8"
    });

    return Promise.resolve(new Response(homePage(content), { headers }));
  }

  // Get player ID from cookies to determine if this is Player 1 or Player 2
  const cookies = _request.headers.get("cookie") || "";
  const playerCookie = cookies
    .split(";")
    .map(c => c.trim())
    .find(c => c.startsWith("hangman_player_id="));

  const playerId = playerCookie?.split("=")[1];

  // If room is full, redirect to game
  if (room.player1 && room.player2 && room.gameState) {
    return Promise.resolve(new Response("", {
      status: 302,
      headers: {
        "Location": `/room/${roomId}/game`
      }
    }));
  }

  // If room is waiting for player 2
  if (room.status === "waiting") {
    // If this is Player 1 (room creator), show waiting room with invitation sharing
    if (playerId === room.player1?.id) {
      const content = roomWaitingComponent(room);
      const headers = new Headers({
        "Content-Type": "text/html; charset=utf-8"
      });
      return Promise.resolve(new Response(homePage(content), { headers }));
    }

    // If this is a new player (Player 2), show join form
    const content = `
    <div class="room-join" id="game-container">
      <div class="join-header">
        <h2>Join Game Room</h2>
        <p>You've been invited to play Hangman with ${room.player1?.name || 'a friend'}!</p>
      </div>

      <div class="join-form-container">
        <form class="join-room-form" hx-post="/room/join" hx-target="#game-container" hx-swap="outerHTML">
          <input type="hidden" name="roomId" value="${roomId}">

          <div class="form-group">
            <label for="join-player-name">Your Name:</label>
            <input type="text" id="join-player-name" name="playerName" required maxlength="20" placeholder="Enter your name" autofocus>
          </div>

          <button type="submit" class="setup-button join-button">Join Game</button>
        </form>
      </div>

      <div class="join-footer">
        <button class="back-button" hx-get="/" hx-target="#game-container" hx-swap="outerHTML">
          ← Back to Game Modes
        </button>
      </div>
    </div>
    `;

    const headers = new Headers({
      "Content-Type": "text/html; charset=utf-8"
    });

    return Promise.resolve(new Response(homePage(content), { headers }));
  }

  // Room is in an unexpected state
  const content = `
  <div class="error-container" id="game-container">
    <div class="error-header">
      <h2>Room Unavailable</h2>
      <p>This game room is not available for joining.</p>
    </div>
    <div class="error-actions">
      <button class="back-button" hx-get="/" hx-target="#game-container" hx-swap="outerHTML">
        ← Back to Game Modes
      </button>
    </div>
  </div>
  `;

  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8"
  });

  return Promise.resolve(new Response(homePage(content), { headers }));
};

/**
 * Handle room game display - show the actual game with waiting state support
 */
export const roomGameHandler = (request: Request, params: Record<string, string>): Promise<Response> => {
  const roomId = params.roomId;
  if (!roomId) {
    return Promise.resolve(new Response("Room ID required", { status: 400 }));
  }

  const room = getGameRoom(roomId);
  if (!room) {
    return Promise.resolve(new Response("Room not found", { status: 404 }));
  }

  // Check if player role is provided in query params (for SSE updates)
  const url = new URL(request.url);
  const playerRoleFromQuery = url.searchParams.get("player");

  // Get player ID from cookies to determine which player this is
  const cookies = request.headers.get("cookie") || "";
  const playerCookie = cookies
    .split(";")
    .map(c => c.trim())
    .find(c => c.startsWith("hangman_player_id="));

  const playerId = playerCookie?.split("=")[1];
  let playerRole = "";

  // Use query parameter if provided (for SSE updates), otherwise determine from cookies
  if (playerRoleFromQuery && (playerRoleFromQuery === "player1" || playerRoleFromQuery === "player2")) {
    playerRole = playerRoleFromQuery;
  } else if (playerId === room.player1?.id) {
    playerRole = "player1";
  } else if (playerId === room.player2?.id) {
    playerRole = "player2";
  }



  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8"
  });

  // If both players are present and game exists, show the active game
  if (room.gameState && room.player1 && room.player2) {
    const content = twoPlayerGameComponent(room.gameState, playerRole);
    return Promise.resolve(new Response(homePage(content), { headers }));
  }

  // If game hasn't started yet (only Player 1 present), create a waiting state game
  if (!room.gameState && room.status === "waiting" && room.player1 && !room.player2) {
    // Create a placeholder game state for Player 1 to see while waiting
    const waitingGameResult = createTwoPlayerGame(
      roomId,
      room.player1.name,
      "Waiting for Player 2...", // Placeholder name
      "medium",
      "General",
      1
    );

    if (waitingGameResult.ok) {
      const waitingGame = waitingGameResult.value;
      // Mark this as a waiting state game
      const content = twoPlayerGameComponentWithInvitation(waitingGame, playerRole, room);
      return Promise.resolve(new Response(homePage(content), { headers }));
    }
  }

  // If both players are present but no game state exists, this shouldn't happen
  // but let's handle it by redirecting to room invitation page
  if (room.player1 && room.player2 && !room.gameState) {
    console.error(`Room ${roomId} has both players but no game state`);
    // Try to create the game state
    const gameResult = createTwoPlayerGame(
      roomId,
      room.player1.name,
      room.player2.name,
      "medium",
      "General",
      1
    );

    if (gameResult.ok) {
      updateRoomGameState(roomId, gameResult.value);
      const content = twoPlayerGameComponent(gameResult.value, playerRole);
      return Promise.resolve(new Response(homePage(content), { headers }));
    }
  }

  // Fallback - redirect to room invitation page
  return Promise.resolve(new Response("", {
    status: 302,
    headers: {
      "Location": `/room/${roomId}`
    }
  }));
};

/**
 * Handle room-based guess requests
 */
export const roomGuessHandler = (request: Request, params: Record<string, string>): Promise<Response> => {
  try {
    const roomId = params.roomId;
    const letter = params.letter?.toUpperCase();

    if (!roomId || !letter) {
      return Promise.resolve(new Response("Room ID and letter required", { status: 400 }));
    }

    // Get player ID from cookies
    const cookies = request.headers.get("cookie") || "";
    const playerCookie = cookies
      .split(";")
      .map(c => c.trim())
      .find(c => c.startsWith("hangman_player_id="));

    const playerId = playerCookie?.split("=")[1];
    if (!playerId) {
      console.error("No player ID found in cookies:", cookies);
      return Promise.resolve(new Response("Player ID required", { status: 400 }));
    }

    const room = getGameRoom(roomId);
    if (!room || !room.gameState) {
      console.error("Room or game state not found:", { roomId, hasRoom: !!room, hasGameState: !!room?.gameState });
      return Promise.resolve(new Response("Game not found", { status: 404 }));
    }

    // Debug logging
    console.log("Room guess attempt:", {
      roomId,
      letter,
      playerId,
      player1Id: room.player1?.id,
      player2Id: room.player2?.id,
      currentTurn: room.gameState.currentTurn
    });

    // Determine player role
    let playerRole = "";
    if (playerId === room.player1?.id) {
      playerRole = "player1";
    } else if (playerId === room.player2?.id) {
      playerRole = "player2";
    } else {
      console.error("Player not found in room:", {
        playerId,
        player1Id: room.player1?.id,
        player2Id: room.player2?.id
      });
      return Promise.resolve(new Response("Unauthorized - Player not in room", { status: 403 }));
    }

    // Check if it's the player's turn
    if (room.gameState.currentTurn !== playerRole) {
      return Promise.resolve(new Response("Not your turn", { status: 400 }));
    }

    // Process the guess
    const updatedStateResult = processTwoPlayerGuess(room.gameState, letter);
    if (!updatedStateResult.ok) {
      return Promise.resolve(new Response(`Error: ${updatedStateResult.error.message}`, { status: 500 }));
    }

    // Update the room with the new game state
    const updateResult = updateRoomGameState(roomId, updatedStateResult.value);
    if (!updateResult.ok) {
      return Promise.resolve(new Response(`Error: ${updateResult.error.message}`, { status: 500 }));
    }

    // Broadcast the game update to all players in the room
    broadcastToRoom(roomId, {
      type: "gameUpdate",
      gameState: updatedStateResult.value,
      lastMove: {
        player: playerRole,
        letter: letter,
        timestamp: Date.now()
      }
    });

    const headers = new Headers({
      "Content-Type": "text/html; charset=utf-8"
    });

    // Return the updated game component
    const content = twoPlayerGameComponent(updatedStateResult.value, playerRole);
    return Promise.resolve(new Response(homePage(content), { headers }));
  } catch (error) {
    console.error("Error in roomGuessHandler:", error);
    return Promise.resolve(new Response(`Error: ${error instanceof Error ? error.message : String(error)}`, { status: 500 }));
  }
};