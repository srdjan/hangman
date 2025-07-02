import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  GenerateRegistrationOptionsOpts,
  VerifyRegistrationResponseOpts,
  GenerateAuthenticationOptionsOpts,
  VerifyAuthenticationResponseOpts,
} from "@simplewebauthn/server";
import { AUTH_CONFIG } from "../auth/config.ts";
import { 
  getUser, 
  createUser, 
  updateUser, 
  createSession, 
  storeChallenge, 
  getChallenge, 
  deleteChallenge 
} from "../auth/kv.ts";
import { toB64, fromB64, generateSessionId, generateUserId } from "../auth/utils.ts";
import { match } from "../utils/pattern.ts";

export const authHandler = async (req: Request): Promise<Response> => {
  console.log("=== Auth Handler Start ===");
  console.log("Method:", req.method);
  console.log("URL:", req.url);
  
  try {
    const url = new URL(req.url);
    const username = url.searchParams.get("username") || "";
    
    console.log("Email from query:", username);
    
    if (!username) {
      console.log("No email provided");
      return new Response("Email address required", { status: 400 });
    }
    
    // Validate email domain
    const emailRegex = /^[a-zA-Z0-9._%+-]+@fadv\.com$/;
    if (!emailRegex.test(username)) {
      console.log("Invalid email domain:", username);
      return new Response("Email must be from @fadv.com domain", { status: 400 });
    }

    // Use fixed origin values
    console.log("Using fixed origin:", AUTH_CONFIG.ORIGIN);
    console.log("Using fixed RP ID:", AUTH_CONFIG.RP_ID);

    // Load or create user
    let user = await getUser(username);
    if (!user) {
      console.log("Creating new user with email:", username);
      user = await createUser(username, username, generateUserId());
    } else {
      console.log("Found existing user with email:", username);
    }

    const { pathname, method } = { pathname: url.pathname, method: req.method };
    console.log("Processing route:", pathname, method);

    return match({ pathname, method })
    .with({ pathname: "/auth/register/options", method: "GET" }, async () => {
      console.log("=== Credential Creation ===");
      console.log("Using RP ID:", AUTH_CONFIG.RP_ID);
      console.log("Using RP Name:", AUTH_CONFIG.RP_NAME);
      console.log("Email:", user.username);
      
      // Create registration options using SimpleWebAuthn
      const opts = await generateRegistrationOptions({
        rpName: AUTH_CONFIG.RP_NAME,
        rpID: AUTH_CONFIG.RP_ID,
        userID: user.id,
        userName: user.username,
        userDisplayName: user.displayName,
        attestationType: 'none',
        authenticatorSelection: {
          residentKey: 'required',
          userVerification: 'required',
          authenticatorAttachment: 'platform',
        },
        supportedAlgorithmIDs: [-7, -257], // ES256, RS256
      });

      console.log("Generated challenge:", opts.challenge);
      console.log("Options:", JSON.stringify(opts, null, 2));

      // SimpleWebAuthn stores the challenge as a string, convert to ArrayBuffer for storage
      const challengeBuffer = new TextEncoder().encode(opts.challenge);
      await storeChallenge(username, challengeBuffer);

      // SimpleWebAuthn already returns properly formatted options
      const responseOptions = opts;
      
      console.log("Sending to client:", JSON.stringify(responseOptions, null, 2));

      return Response.json(responseOptions);
    })
    
    .with({ pathname: "/auth/register/verify", method: "POST" }, async () => {
      console.log("=== Registration Verify START ===");
      console.log("Username:", username);
      console.log("Request method:", req.method);
      console.log("Request URL:", req.url);
      
      let requestBody;
      try {
        const bodyText = await req.text();
        console.log("Raw request body:", bodyText.substring(0, 200) + "...");
        requestBody = JSON.parse(bodyText);
        console.log("Request body parsed successfully");
      } catch (error) {
        console.error("Failed to parse request body:", error);
        return new Response("Invalid request body", { status: 400 });
      }
      
      const { id, rawId, response } = requestBody;
      console.log("Received credential ID:", id);
      console.log("Received rawId length:", rawId?.length);
      console.log("Received response keys:", Object.keys(response || {}));
      
      const storedChallenge = await getChallenge(username);
      console.log("Stored challenge found:", !!storedChallenge);
      console.log("Stored challenge length:", storedChallenge?.length);
      
      if (!storedChallenge) {
        console.log("No challenge found for username:", username);
        return new Response("No challenge found", { status: 400 });
      }

      try {
        // Parse client data to see what origin was actually sent
        console.log("About to parse client data...");
        const clientDataJSON = JSON.parse(new TextDecoder().decode(fromB64(response.clientDataJSON)));
        console.log("Parsed client data successfully");
        console.log("Client data origin:", clientDataJSON.origin);
        console.log("Client data type:", clientDataJSON.type);
        console.log("Expected origin:", AUTH_CONFIG.ORIGIN);
        console.log("Expected RP ID:", AUTH_CONFIG.RP_ID);
        
        console.log("About to call verifyRegistration...");
        console.log("Challenge length:", storedChallenge.length);
        console.log("Stored challenge (base64):", toB64(new Uint8Array(storedChallenge).buffer));
        console.log("Client challenge (from clientData):", clientDataJSON.challenge);
        console.log("Raw ID length:", fromB64(rawId).length);
        
        // Convert stored challenge back to string for SimpleWebAuthn
        const storedChallengeString = new TextDecoder().decode(new Uint8Array(storedChallenge));
        console.log("Stored challenge string:", storedChallengeString);
        console.log("Client challenge (from clientData):", clientDataJSON.challenge);
        
        let verified = false;
        let registrationInfo = null;
        
        try {
          console.log("Attempting verification with SimpleWebAuthn...");
          
          const verification = await verifyRegistrationResponse({
            response: {
              id,
              rawId,
              response: {
                clientDataJSON: response.clientDataJSON,
                attestationObject: response.attestationObject,
              },
              type: "public-key",
            },
            expectedChallenge: storedChallengeString,
            expectedOrigin: AUTH_CONFIG.ORIGIN,
            expectedRPID: AUTH_CONFIG.RP_ID,
            requireUserVerification: true,
          });
          
          verified = verification.verified;
          if (verified && verification.registrationInfo) {
            console.log("Registration info from SimpleWebAuthn:", {
              credentialID: verification.registrationInfo.credentialID,
              credentialIDType: typeof verification.registrationInfo.credentialID,
              credentialIDLength: verification.registrationInfo.credentialID?.length,
            });
            
            registrationInfo = {
              credentialId: verification.registrationInfo.credentialID,
              credentialPublicKey: verification.registrationInfo.credentialPublicKey,
              counter: verification.registrationInfo.counter,
            };
          }
          
          console.log("SimpleWebAuthn verification result:", verified);
          console.log("Storing credential info:", registrationInfo);
          
        } catch (error) {
          console.error("SimpleWebAuthn verification error:", error);
          verified = false;
        }
        
        if (!verified) {
          console.log("SimpleWebAuthn verification failed");
          return new Response("Registration verification failed", { status: 400 });
        }
        
        console.log("Registration verification successful!");

        // Add credential to user
        user.credentials.push(registrationInfo);
        await updateUser(username, user);
        await deleteChallenge(username);

        return Response.json({ success: true });
      } catch (error) {
        console.error("Registration verification error:", error);
        console.error("Error stack:", error.stack);
        return new Response(`Registration verification failed: ${error.message}`, { status: 500 });
      }
    })
    
    .with({ pathname: "/auth/login/options", method: "GET" }, async () => {
      console.log("=== Login Options ===");
      console.log("User credentials count:", user.credentials.length);
      console.log("User credentials:", user.credentials.map(c => ({
        id: c.credentialId,
        type: typeof c.credentialId,
        length: c.credentialId?.length
      })));

      const allowCredentials = user.credentials.map((c) => ({
        id: c.credentialId, // SimpleWebAuthn handles the conversion automatically
        type: "public-key" as const,
      }));
      
      console.log("Allow credentials:", allowCredentials);

      const opts = await generateAuthenticationOptions({
        rpID: AUTH_CONFIG.RP_ID,
        allowCredentials,
        userVerification: 'required',
      });
      
      console.log("Generated login options:", JSON.stringify(opts, null, 2));

      // Store challenge as string for SimpleWebAuthn
      const challengeBuffer = new TextEncoder().encode(opts.challenge);
      await storeChallenge(username, challengeBuffer);

      return Response.json(opts);
    })
    
    .with({ pathname: "/auth/login/verify", method: "POST" }, async () => {
      const { id, rawId, response } = await req.json();
      const storedChallenge = await getChallenge(username);
      
      if (!storedChallenge) {
        return new Response("No challenge found", { status: 400 });
      }

      console.log("Looking for credential with rawId:", rawId);
      console.log("Available credentials:", user.credentials.map(c => c.credentialId));
      
      // Compare rawId (base64url string) directly with stored credentialId (also base64url string)
      const credential = user.credentials.find(
        (c) => c.credentialId === rawId,
      );

      if (!credential) {
        console.log("Credential not found! RawId:", rawId);
        console.log("Available credential IDs:", user.credentials.map(c => c.credentialId));
        return Response.json({ success: false, error: "Unknown credential" });
      }
      
      console.log("Found matching credential:", credential.credentialId);

      try {
        console.log("=== Login Verification ===");
        
        // Convert stored challenge back to string for SimpleWebAuthn
        const storedChallengeString = new TextDecoder().decode(new Uint8Array(storedChallenge));
        
        const verification = await verifyAuthenticationResponse({
          response: {
            id,
            rawId,
            response: {
              clientDataJSON: response.clientDataJSON,
              authenticatorData: response.authenticatorData,
              signature: response.signature,
              userHandle: response.userHandle,
            },
            type: "public-key",
          },
          expectedChallenge: storedChallengeString,
          expectedOrigin: AUTH_CONFIG.ORIGIN,
          expectedRPID: AUTH_CONFIG.RP_ID,
          authenticator: {
            credentialID: credential.credentialId,
            credentialPublicKey: credential.credentialPublicKey,
            counter: credential.counter,
          },
          requireUserVerification: true,
        });

        if (!verification.verified) {
          console.log("SimpleWebAuthn verification failed");
          return Response.json({ success: false });
        }

        console.log("SimpleWebAuthn verification successful!");

        // Create session
        const sessionId = generateSessionId();
        await createSession(sessionId, username);
        await deleteChallenge(username);

        console.log("Session created:", sessionId);

        // For localhost development, don't use Secure flag
        const cookie = [
          `session=${sessionId}`,
          `Path=/`,
          `HttpOnly`,
          `SameSite=Strict`,
          `Max-Age=86400`, // 24 hours
        ].join("; ");

        console.log("Setting cookie:", cookie);
        console.log("Sending successful login response with session cookie");

        return new Response(JSON.stringify({ success: true, redirect: "/" }), {
          status: 200,
          headers: {
            "Set-Cookie": cookie,
            "Content-Type": "application/json",
          },
        });
      } catch (error) {
        console.error("Authentication verification error:", error);
        return new Response("Authentication verification failed", { status: 500 });
      }
    })
    
    .with({ pathname: "/auth/logout", method: "POST" }, async () => {
      const match = /(?:^|; )session=([^;]+)/.exec(req.headers.get("cookie") || "");
      const sessionId = match?.[1];
      
      if (sessionId) {
        // Don't need to await this
        deleteChallenge(username).catch(() => {});
      }

      // Clear the session cookie
      const cookie = [
        `session=`,
        `Path=/`,
        `HttpOnly`,
        `Secure`,
        `SameSite=Strict`,
        `Max-Age=0`,
      ].join("; ");

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          "Set-Cookie": cookie,
          "Content-Type": "application/json",
        },
      });
    })
    
    .otherwise(() => new Response("Not found", { status: 404 }));
    
  } catch (error) {
    console.error("Critical error in auth handler:", error);
    return new Response(`Auth handler critical error: ${error.message}`, { status: 500 });
  }
};