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

// Win sequence management
export interface WinRecord {
  sequenceNumber: number;
  username: string;
  word: string;
  completionTime: string;
  duration: number;
  totalGuesses: number;
  hintsUsed: number;
  completionMethod: "guess" | "hint";
  difficulty: string;
  category: string;
  gameId: string;
}

export async function getNextWinSequence(): Promise<number> {
  const kvStore = await getKv();
  
  // Use atomic operation to increment the counter
  const result = await kvStore.atomic()
    .mutate({
      type: "sum",
      key: ["global", "win_sequence_counter"],
      value: new Deno.KvU64(1n),
    })
    .commit();
    
  if (result.ok) {
    // Get the updated counter value
    const counterResult = await kvStore.get<Deno.KvU64>(["global", "win_sequence_counter"]);
    return Number(counterResult.value?.value || 1n);
  } else {
    // Fallback: try to get current value and increment manually
    const counterResult = await kvStore.get<Deno.KvU64>(["global", "win_sequence_counter"]);
    const currentValue = Number(counterResult.value?.value || 0n);
    const nextValue = currentValue + 1;
    
    await kvStore.set(["global", "win_sequence_counter"], new Deno.KvU64(BigInt(nextValue)));
    return nextValue;
  }
}

export async function recordWin(winRecord: WinRecord): Promise<void> {
  const kvStore = await getKv();
  
  // Store the win record with sequence number as key for easy retrieval
  await kvStore.set(["wins", winRecord.sequenceNumber], winRecord);
  
  // Also store by username for user-specific queries
  await kvStore.set(["user_wins", winRecord.username, winRecord.sequenceNumber], winRecord);
}

export async function getTotalWins(): Promise<number> {
  const kvStore = await getKv();
  const counterResult = await kvStore.get<Deno.KvU64>(["global", "win_sequence_counter"]);
  return Number(counterResult.value?.value || 0n);
}

export async function getRecentWins(limit: number = 10): Promise<WinRecord[]> {
  const kvStore = await getKv();
  const wins: WinRecord[] = [];
  
  for await (const { value } of kvStore.list<WinRecord>({ prefix: ["wins"] }, { 
    limit, 
    reverse: true // Get most recent first
  })) {
    if (value) {
      wins.push(value);
    }
  }
  
  return wins;
}