```typescript
import { serve } from "https://deno.land/std@0.167.0/http/server.ts";
import {
  credentialCreationOptions,
  credentialRequestOptions,
  verifyRegistration,
  verifyAuthentication,
} from "https://deno.land/x/webauthn_deno@v0.2.2/mod.ts";

// Configuration
const ORIGIN = Deno.env.get("ORIGIN") || "https://example.com";
const RP_ID = new URL(ORIGIN).hostname;
const SESSION_TTL_MS = 1000 * 60 * 30;        // 30 minutes
const RATE_LIMIT_WINDOW_MS = 1000 * 60;       // 1 minute
const RATE_LIMIT_MAX_REQ = 60;                // max requests per window

// Deno KV
const kv = await Deno.openKv();

// In-memory rate-limit store
const rateMap = new Map<string, { count: number; windowStart: number }>();

// Helpers
const toB64 = (b: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(b)));
const fromB64 = (s: string) =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const now = () => Date.now();

async function cleanupSessions() {
  for await (const { key, value } of kv.list<{ username: string; created: number }>(
    { prefix: ["session"] },
  )) {
    if (now() - value.created > SESSION_TTL_MS) {
      await kv.delete(key);
      console.log(`[CLEANUP] expired session ${key[1]}`);
    }
  }
}
setInterval(cleanupSessions, 1000 * 60 * 10); // every 10min

function logRequest(ip: string, method: string, url: string, status: number) {
  console.log(
    `[${new Date().toISOString()}] ${ip} ${method} ${url} → ${status}`,
  );
}

async function handler(req: Request): Promise<Response> {
  // Rate limiting
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const t = now();
  const entry = rateMap.get(ip) ?? { count: 0, windowStart: t };
  if (t - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = t;
  }
  entry.count++;
  rateMap.set(ip, entry);
  if (entry.count > RATE_LIMIT_MAX_REQ) {
    logRequest(ip, req.method, req.url, 429);
    return new Response("Too many requests", { status: 429 });
  }

  // Enforce HTTPS
  if (req.headers.get("x-forwarded-proto") !== "https") {
    logRequest(ip, req.method, req.url, 400);
    return new Response("Use HTTPS", { status: 400 });
  }

  const url = new URL(req.url);
  const username = url.searchParams.get("username") || "";
  if (!username) {
    logRequest(ip, req.method, req.url, 400);
    return new Response("username required", { status: 400 });
  }

  // Load or init user
  const userKey = ["user", username] as const;
  let user = await kv.get<{ id: Uint8Array; credentials: any[] }>(userKey);
  if (!user.value) {
    const newUser = {
      id: crypto.getRandomValues(new Uint8Array(16)),
      credentials: [] as any[],
    };
    await kv.set(userKey, newUser);
    user = { key: userKey, value: newUser };
  }

  let res: Response;
  // -- Registration options --
  if (url.pathname === "/register/options" && req.method === "GET") {
    const opts = credentialCreationOptions({
      rp: { name: "ExampleSite", id: RP_ID },
      user: { id: user.value.id, name: username, displayName: username },
    });
    await kv.set(["challenge", username], opts.challenge);
    res = Response.json({
      ...opts,
      challenge: toB64(opts.challenge.buffer),
    });
  }
  // -- Verify registration --
  else if (url.pathname === "/register/verify" && req.method === "POST") {
    const { id, rawId, response } = await req.json();
    const stored = await kv.get<ArrayBuffer>(["challenge", username]);
    if (!stored.value) {
      res = new Response("No challenge", { status: 400 });
    } else {
      const { verified, registrationInfo } = await verifyRegistration({
        credential: {
          id,
          rawId: fromB64(rawId),
          response: {
            clientDataJSON: fromB64(response.clientDataJSON),
            attestationObject: fromB64(response.attestationObject),
          },
        },
        expectedChallenge: new Uint8Array(stored.value),
        expectedOrigin: ORIGIN,
        expectedRpId: RP_ID,
      });
      if (!verified) {
        res = new Response("Registration failed", { status: 400 });
      } else {
        user.value.credentials.push(registrationInfo);
        await kv.set(userKey, user.value);
        res = Response.json({ success: true });
      }
    }
  }
  // -- Authentication options --
  else if (url.pathname === "/auth/options" && req.method === "GET") {
    const allow = user.value.credentials.map((c) => ({
      id: c.credentialId,
      type: "public-key",
    }));
    const opts = credentialRequestOptions({ allowCredentials: allow });
    await kv.set(["challenge", username], opts.challenge);
    res = Response.json({
      ...opts,
      challenge: toB64(opts.challenge.buffer),
    });
  }
  // -- Verify authentication --
  else if (url.pathname === "/auth/verify" && req.method === "POST") {
    const { id, rawId, response } = await req.json();
    const stored = await kv.get<ArrayBuffer>(["challenge", username]);
    if (!stored.value) {
      res = new Response("No challenge", { status: 400 });
    } else {
      const cred = user.value.credentials.find(
        (c) => c.credentialId === fromB64(rawId),
      );
      if (!cred) {
        res = new Response("Unknown credential", { status: 400 });
      } else {
        const { verified } = await verifyAuthentication({
          credential: {
            id,
            rawId: fromB64(rawId),
            response: {
              clientDataJSON: fromB64(response.clientDataJSON),
              authenticatorData: fromB64(response.authenticatorData),
              signature: fromB64(response.signature),
              userHandle: response.userHandle
                ? fromB64(response.userHandle)
                : undefined,
            },
          },
          expectedChallenge: new Uint8Array(stored.value),
          expectedOrigin: ORIGIN,
          expectedRpId: RP_ID,
          authenticator: cred,
        });
        if (!verified) {
          res = Response.json({ success: false });
        } else {
          const sessionId = crypto.getRandomValues(new Uint8Array(16))
            .reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");
          await kv.set(["session", sessionId], {
            username,
            created: now(),
          });
          const cookie = [
            `session=${sessionId}`,
            `Path=/`,
            `HttpOnly`,
            `Secure`,
            `SameSite=Strict`,
          ].join("; ");
          res = new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: {
              "Set-Cookie": cookie,
              "Content-Type": "application/json",
            },
          });
        }
      }
    }
  }
  // -- Protected profile --
  else if (url.pathname === "/profile" && req.method === "GET") {
    const match = /session=([^;]+)/.exec(req.headers.get("cookie") || "");
    const sid = match?.[1];
    if (!sid) {
      res = new Response("Unauthorized", { status: 401 });
    } else {
      const ses = await kv.get<{ username: string; created: number }>([
        "session",
        sid,
      ]);
      if (!ses.value || now() - ses.value.created > SESSION_TTL_MS) {
        await kv.delete(["session", sid]);
        res = new Response("Session expired", { status: 401 });
      } else {
        res = Response.json({ username: ses.value.username });
      }
    }
  }
  // -- Not found --
  else {
    res = new Response("Not found", { status: 404 });
  }

  // Log and return
  logRequest(ip, req.method, req.url, res.status);
  return res;
}

console.log(`Server running on ${ORIGIN}`);
await serve(handler, { port: 8000 });
```
