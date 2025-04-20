import { GameState } from "../types.ts";

const sessions = new Map<string, GameState>();

export const getSession = (sessionId: string): GameState | undefined =>
  sessions.get(sessionId);

export const setSession = (sessionId: string, gameState: GameState): void => {
  sessions.set(sessionId, gameState);
};

export const createSession = (gameState: GameState): string => {
  const sessionId = crypto.randomUUID();
  setSession(sessionId, gameState);
  return sessionId;
};

export const deleteSession = (sessionId: string): boolean =>
  sessions.delete(sessionId);