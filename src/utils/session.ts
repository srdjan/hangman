import { getSession, setSession, createSession } from "../state/session.ts";
import { GameState } from "../types.ts";
import { createGameCookie } from "./http.ts";

/**
 * Session management utilities to eliminate duplication of session handling patterns
 */

/**
 * Extract session ID from request cookies
 * Handles the common pattern of parsing the hangman_session cookie
 */
export function extractSessionId(request: Request): string | null {
  const cookies = request.headers.get("cookie") || "";
  const sessionCookie = cookies
    .split(";")
    .map(c => c.trim())
    .find(c => c.startsWith("hangman_session="));

  return sessionCookie?.split("=")[1] || null;
}

/**
 * Get game session from request
 * Returns tuple of [sessionId, gameState] for consistent handling
 */
export function getGameSession(request: Request): [string | null, GameState | undefined] {
  const sessionId = extractSessionId(request);
  const gameState = sessionId ? getSession(sessionId) : undefined;
  
  return [sessionId, gameState];
}

/**
 * Create a new game session and return the session ID
 * Handles the common pattern of creating session and storing game state
 */
export function createNewSession(gameState: GameState): string {
  return createSession(gameState);
}

/**
 * Update an existing game session
 * Handles the common pattern of updating session with new game state
 */
export function updateGameSession(sessionId: string, gameState: GameState): void {
  setSession(sessionId, gameState);
}

/**
 * Create session response headers
 * Standardizes session cookie creation for responses
 */
export function createSessionHeaders(sessionId: string): Record<string, string> {
  return {
    "Set-Cookie": createGameCookie(sessionId)
  };
}

/**
 * Session validation helper
 * Checks if session exists and game state is valid
 */
export function isValidSession(sessionId: string | null, gameState: GameState | undefined): boolean {
  return !!(sessionId && gameState);
}

/**
 * Session cleanup helper
 * Can be extended later to handle session expiration/cleanup
 */
export function cleanupSession(sessionId: string): void {
  // For now, this is a placeholder for future session cleanup logic
  // Could include removing expired sessions, logging cleanup events, etc.
  console.log(`Session cleanup: ${sessionId}`);
}

/**
 * Extract auth session ID from request cookies
 * Similar to extractSessionId but for authentication sessions
 */
export function extractAuthSessionId(request: Request): string | null {
  const cookies = request.headers.get("cookie") || "";
  const sessionCookie = cookies
    .split(";")
    .map(c => c.trim())
    .find(c => c.startsWith("auth_session="));

  return sessionCookie?.split("=")[1] || null;
}

/**
 * Session state helpers for common patterns
 */
export const SessionState = {
  /**
   * Check if user has an active game session
   */
  hasActiveGame(request: Request): boolean {
    const [sessionId, gameState] = getGameSession(request);
    return isValidSession(sessionId, gameState) && gameState?.status === "playing";
  },

  /**
   * Check if user needs to start a new game
   */
  needsNewGame(request: Request): boolean {
    const [sessionId, gameState] = getGameSession(request);
    return !isValidSession(sessionId, gameState) || gameState?.status !== "playing";
  },

  /**
   * Get game status from session
   */
  getGameStatus(request: Request): string | null {
    const [, gameState] = getGameSession(request);
    return gameState?.status || null;
  }
} as const;