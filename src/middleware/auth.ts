import { getSession } from "../auth/kv.ts";
import { AuthState } from "../auth/types.ts";

export async function requireAuth(req: Request): Promise<AuthState | Response> {
  console.log("=== AUTH MIDDLEWARE ===");
  const cookies = req.headers.get("cookie") || "";
  console.log("Cookies received:", cookies);
  
  const match = /(?:^|; )session=([^;]+)/.exec(cookies);
  const sessionId = match?.[1];
  console.log("Session ID extracted:", sessionId);

  if (!sessionId) {
    console.log("No session ID found, redirecting to login");
    return new Response(null, {
      status: 302,
      headers: { "Location": "/login" },
    });
  }

  const session = await getSession(sessionId);
  console.log("Session retrieved:", session);

  if (!session) {
    console.log("Invalid session, clearing cookie and redirecting to login");
    // Clear invalid session cookie
    return new Response(null, {
      status: 302,
      headers: { 
        "Location": "/login",
        "Set-Cookie": "session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0",
      },
    });
  }

  console.log("Auth successful for user:", session.username);
  return {
    isAuthenticated: true,
    username: session.username,
  };
}

export async function getAuthState(req: Request): Promise<AuthState> {
  const cookies = req.headers.get("cookie") || "";
  const match = /(?:^|; )session=([^;]+)/.exec(cookies);
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