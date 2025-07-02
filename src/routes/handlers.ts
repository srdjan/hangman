import { createGame, processGuess, getHint } from "../state/game.ts";
import { getSession, setSession, createSession } from "../state/session.ts";
import { homePage, gameComponent } from "../views/home.ts";
import { GameState } from "../types.ts";
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

export const gameHandler = (request: Request, _params?: Record<string, string>): Promise<Response> => {
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
    // Fixed values - all games are hard difficulty with countries category
    const difficulty: "easy" | "medium" | "hard" = "hard";
    const category = "Countries";
    const hintsAllowed = 1;

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

  // Process the guess and update the session
  const updatedStateResult = processGuess(gameState, letter);

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

  // Process the hint and update the session
  const updatedStateResult = getHint(gameState);

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