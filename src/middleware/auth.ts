import { getSession } from "../auth/kv.ts";
import { AuthState } from "../auth/types.ts";

export async function requireAuth(req: Request): Promise<AuthState | Response> {
  const cookies = req.headers.get("cookie") || "";
  const match = /session=([^;]+)/.exec(cookies);
  const sessionId = match?.[1];

  if (!sessionId) {
    return new Response(null, {
      status: 302,
      headers: { "Location": "/login" },
    });
  }

  const session = await getSession(sessionId);

  if (!session) {
    // Clear invalid session cookie
    return new Response(null, {
      status: 302,
      headers: { 
        "Location": "/login",
        "Set-Cookie": "session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0",
      },
    });
  }

  return {
    isAuthenticated: true,
    username: session.username,
  };
}

export async function getAuthState(req: Request): Promise<AuthState> {
  const cookies = req.headers.get("cookie") || "";
  const match = /session=([^;]+)/.exec(cookies);
  const sessionId = match?.[1];

  if (!sessionId) {
    return { isAuthenticated: false };
  }

  const session = await getSession(sessionId);

  if (!session) {
    return { isAuthenticated: false };
  }

  return {
    isAuthenticated: true,
    username: session.username,
  };
}