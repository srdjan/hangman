import { createGame, processGuess } from "../state/game.ts";
import { getSession, setSession, createSession } from "../state/session.ts";
import { baseTemplate, gameComponent } from "../views/templates.ts";
import { GameState } from "../types.ts";
import { Result, ok } from "../utils/result.ts";

/**
 * Retrieve or initialize a game session from request
 */
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

/**
 * Handle the main game page request
 */
export const gameHandler = (request: Request): Promise<Response> => {
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
  return Promise.resolve(new Response(baseTemplate(content), { headers }));
};

/**
 * Handle new game creation request
 */
// Inside newGameHandler function
export const newGameHandler = async (request: Request): Promise<Response> => {
  const sessionResult = getOrCreateGameSession(request);

  if (!sessionResult.ok) {
    return Promise.resolve(new Response(`Error: ${sessionResult.error.message}`, { status: 500 }));
  }

  const [sessionId, _] = sessionResult.value;

  try {
    // First check if this is JSON data from hx-vals
    let difficulty = "medium";
    const contentType = request.headers.get("Content-Type");
    
    if (contentType && contentType.includes("application/json")) {
      // From pill buttons using hx-vals
      const jsonData = await request.json();
      if (jsonData.difficulty && 
          (jsonData.difficulty === "easy" || 
           jsonData.difficulty === "medium" || 
           jsonData.difficulty === "hard")) {
        difficulty = jsonData.difficulty;
      }
    } else {
      // From traditional form data
      const formData = await request.formData();
      const difficultyValue = formData.get("difficulty");
      if (difficultyValue === "easy" || 
          difficultyValue === "medium" || 
          difficultyValue === "hard") {
        difficulty = difficultyValue;
      }
    }

    const gameResult = createGame(difficulty);
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
 * Handle static file requests
 */
export const staticFileHandler = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const filePath = url.pathname.replace(/^\/static\//, "");

  try {
    const contents = await Deno.readFile(`./static/${filePath}`);

    const contentType = filePath.endsWith(".css")
      ? "text/css"
      : filePath.endsWith(".js")
        ? "text/javascript"
        : "application/octet-stream";

    return Promise.resolve(new Response(contents, {
      headers: { "Content-Type": contentType }
    }));
  } catch {
    return Promise.resolve(new Response("Not found", { status: 404 }));
  }
};