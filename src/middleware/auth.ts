import { getSession } from "../auth/kv.ts";
import { AuthState } from "../auth/types.ts";
import { getGameSession } from "../utils/session.ts";

export async function requireAuth(req: Request): Promise<AuthState | Response> {
  const cookies = req.headers.get("cookie") || "";
  
  // First, try to get auth session (priority)
  const authMatch = /(?:^|; )session=([^;]+)/.exec(cookies);
  const authSessionId = authMatch?.[1];

  if (authSessionId) {
    const authSession = await getSession(authSessionId);
    
    if (authSession) {
      return {
        isAuthenticated: true,
        username: authSession.username,
      };
    }
  }

  // Fallback: try to get game session
  const [gameSessionId, gameState] = getGameSession(req);

  if (gameSessionId && gameState?.username) {
    return {
      isAuthenticated: true,
      username: gameState.username,
    };
  }
  return new Response(null, {
    status: 302,
    headers: { "Location": "/login" },
  });
}

export async function getAuthState(req: Request): Promise<AuthState> {
  const cookies = req.headers.get("cookie") || "";
  
  // First, try auth session
  const authMatch = /(?:^|; )session=([^;]+)/.exec(cookies);
  const authSessionId = authMatch?.[1];

  if (authSessionId) {
    const authSession = await getSession(authSessionId);
    if (authSession) {
      return {
        isAuthenticated: true,
        username: authSession.username,
      };
    }
  }

  // Fallback: try game session
  const [gameSessionId, gameState] = getGameSession(req);
  if (gameSessionId && gameState?.username) {
    return {
      isAuthenticated: true,
      username: gameState.username,
    };
  }

  return { isAuthenticated: false };
}