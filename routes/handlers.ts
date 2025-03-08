import { createGame, processGuess } from "../state/game.ts";
import { getSession, setSession, createSession } from "../state/session.ts";
import { baseTemplate, gameComponent } from "../views/templates.ts";
import { GameState, WordDifficulty } from "../types.ts";
import * as path from "https://deno.land/std@0.188.0/path/mod.ts";

// Helper to get or create session
const getOrCreateGameSession = (request: Request): [string, GameState] => {
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
    gameState = createGame();
    sessionId = createSession(gameState);
  }

  return [sessionId, gameState];
};

// Handle the main game page
export const gameHandler = async (request: Request): Promise<Response> => {
  const [sessionId, gameState] = getOrCreateGameSession(request);

  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Set-Cookie": `hangman_session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600`
  });

  const content = gameComponent(gameState);
  return new Response(baseTemplate(content), { headers });
};

// Handle creation of a new game
export const newGameHandler = async (request: Request): Promise<Response> => {
  const [sessionId, _] = getOrCreateGameSession(request);

  const formData = await request.formData();
  const difficulty = formData.get("difficulty") as WordDifficulty || "medium";

  const gameState = createGame(difficulty);
  setSession(sessionId, gameState);

  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Set-Cookie": `hangman_session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600`
  });

  return new Response(gameComponent(gameState), { headers });
};

// Handle a letter guess
export const guessHandler = async (request: Request, params: Record<string, string>): Promise<Response> => {
  const letter = params.letter?.toUpperCase() || "";
  if (!/^[A-Z]$/.test(letter)) {
    return new Response("Invalid letter", { status: 400 });
  }

  const [sessionId, gameState] = getOrCreateGameSession(request);

  // Process the guess and update the session
  const updatedState = processGuess(gameState, letter);
  setSession(sessionId, updatedState);

  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Set-Cookie": `hangman_session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600`
  });

  return new Response(gameComponent(updatedState), { headers });
};

// Handle static files
export const staticFileHandler = async (request: Request, params: Record<string, string>): Promise<Response> => {
  const url = new URL(request.url);
  const filePath = url.pathname.replace(/^\/static\//, "");

  try {
    const contents = await Deno.readFile(`./static/${filePath}`);

    const contentType = filePath.endsWith(".css")
      ? "text/css"
      : filePath.endsWith(".js")
        ? "text/javascript"
        : "application/octet-stream";

    return new Response(contents, {
      headers: { "Content-Type": contentType }
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
};