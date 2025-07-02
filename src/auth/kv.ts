import { AUTH_CONFIG } from "./config.ts";
import { User, Session } from "./types.ts";
import { now } from "./utils.ts";

let kv: Deno.Kv | null = null;

export async function getKv(): Promise<Deno.Kv> {
  if (!kv) {
    kv = await Deno.openKv();
    console.log("Deno KV opened for authentication");
  }
  return kv;
}

export async function closeKv(): Promise<void> {
  if (kv) {
    kv.close();
    kv = null;
  }
}

// User management
export async function getUser(username: string): Promise<User | null> {
  const kvStore = await getKv();
  const result = await kvStore.get<User>(["user", username]);
  return result.value;
}

export async function createUser(username: string, displayName: string, id: Uint8Array): Promise<User> {
  const kvStore = await getKv();
  const user: User = {
    id,
    username,
    displayName,
    credentials: [],
    createdAt: now(),
  };
  await kvStore.set(["user", username], user);
  return user;
}

export async function updateUser(username: string, user: User): Promise<void> {
  const kvStore = await getKv();
  await kvStore.set(["user", username], user);
}

// Session management
export async function createSession(sessionId: string, username: string): Promise<void> {
  const kvStore = await getKv();
  const session: Session = {
    username,
    created: now(),
  };
  await kvStore.set(["session", sessionId], session);
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const kvStore = await getKv();
  const result = await kvStore.get<Session>(["session", sessionId]);
  
  if (!result.value) return null;
  
  // Check if session is expired
  if (now() - result.value.created > AUTH_CONFIG.SESSION_TTL_MS) {
    await deleteSession(sessionId);
    return null;
  }
  
  return result.value;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const kvStore = await getKv();
  await kvStore.delete(["session", sessionId]);
}

// Challenge management (for WebAuthn)
export async function storeChallenge(username: string, challenge: ArrayBuffer): Promise<void> {
  const kvStore = await getKv();
  await kvStore.set(["challenge", username], challenge);
}

export async function getChallenge(username: string): Promise<ArrayBuffer | null> {
  const kvStore = await getKv();
  const result = await kvStore.get<ArrayBuffer>(["challenge", username]);
  return result.value;
}

export async function deleteChallenge(username: string): Promise<void> {
  const kvStore = await getKv();
  await kvStore.delete(["challenge", username]);
}

// Cleanup expired sessions
export async function cleanupExpiredSessions(): Promise<void> {
  const kvStore = await getKv();
  
  for await (const { key, value } of kvStore.list<Session>({ prefix: ["session"] })) {
    if (now() - value.created > AUTH_CONFIG.SESSION_TTL_MS) {
      await kvStore.delete(key);
      console.log(`[CLEANUP] expired session ${key[1]}`);
    }
  }
}

// Setup periodic cleanup (every 10 minutes)
setInterval(cleanupExpiredSessions, 1000 * 60 * 10);