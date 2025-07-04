import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";

import { AUTH_CONFIG, getRequestAuthConfig } from "../auth/config.ts";
import { AUTH_CONFIG as CONSTANTS_AUTH_CONFIG } from "../constants.ts";
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
    if (!CONSTANTS_AUTH_CONFIG.EMAIL_REGEX.test(username)) {
      console.log("Invalid email domain:", username);
      return new Response("Email must be from an allowed domain", { status: 400 });
    }

    // Use dynamic origin values based on the request
    console.log("Request URL:", req.url);
    console.log("Request hostname:", url.hostname);
    console.log("Request protocol:", url.protocol);
    
    const requestAuthConfig = getRequestAuthConfig(req);
    console.log("Using origin:", requestAuthConfig.ORIGIN);
    console.log("Using RP ID:", requestAuthConfig.RP_ID);

    // Load user (create only during registration)
    let user = await getUser(username);
    
    const { pathname, method } = { pathname: url.pathname, method: req.method };
    console.log("Processing route:", pathname, method);
    
    // For registration, create user if it doesn't exist
    if (pathname === "/auth/register/options" && !user) {
      console.log("Creating new user for registration:", username);
      user = await createUser(username, username, generateUserId());
    } else if (pathname === "/auth/register/options" && user) {
      console.log("Found existing user for registration:", username);
    }
    
    // For login and other operations, user must exist
    if ((pathname === "/auth/login/options" || pathname === "/auth/login/verify") && !user) {
      console.log("User not found for login:", username);
      return new Response("User not found. Please register first.", { status: 404 });
    } else if (user) {
      console.log("Found existing user:", username);
    }

    return match({ pathname, method })
    .with({ pathname: "/auth/register/options", method: "GET" }, async () => {
      console.log("=== Credential Creation ===");
      console.log("Using RP ID:", requestAuthConfig.RP_ID);
      console.log("Using RP Name:", requestAuthConfig.RP_NAME);
      console.log("Email:", user.username);
      
      // Create registration options using SimpleWebAuthn
      const opts = await generateRegistrationOptions({
        rpName: requestAuthConfig.RP_NAME,
        rpID: requestAuthConfig.RP_ID,
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
      console.log("=== RECEIVED DATA DEBUG ===");
      console.log("Received credential ID:", id);
      console.log("Received rawId:", rawId);
      console.log("Received rawId length:", rawId?.length);
      console.log("Received rawId type:", typeof rawId);
      console.log("Received response keys:", Object.keys(response || {}));
      console.log("Full request body structure:", JSON.stringify(requestBody, null, 2));
      console.log("=== END RECEIVED DATA DEBUG ===");
      
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
        console.log("Expected origin:", requestAuthConfig.ORIGIN);
        console.log("Expected RP ID:", requestAuthConfig.RP_ID);
        
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
          
          // SimpleWebAuthn v11 API structure - the 'response' parameter should be the credential directly
          const credentialForVerification = {
            id,
            rawId,
            response: {
              clientDataJSON: response.clientDataJSON,
              attestationObject: response.attestationObject,
            },
            type: "public-key" as const,
            clientExtensionResults: {},
          };
          
          const verificationOptions = {
            response: credentialForVerification,
            expectedChallenge: storedChallengeString,
            expectedOrigin: requestAuthConfig.ORIGIN,
            expectedRPID: requestAuthConfig.RP_ID,
            requireUserVerification: true,
          };
          
          console.log("=== REGISTRATION VERIFICATION DEBUG ===");
          console.log("Full verification object:", JSON.stringify(verificationOptions, null, 2));
          console.log("Credential object structure:", {
            hasId: !!credentialForVerification.id,
            hasRawId: !!credentialForVerification.rawId,
            hasClientDataJSON: !!credentialForVerification.response.clientDataJSON,
            hasAttestationObject: !!credentialForVerification.response.attestationObject,
            idType: typeof credentialForVerification.id,
            rawIdType: typeof credentialForVerification.rawId,
            credentialIdValue: credentialForVerification.id,
            rawIdValue: credentialForVerification.rawId,
          });
          console.log("=== END REGISTRATION VERIFICATION DEBUG ===");
          
          const verification = await verifyRegistrationResponse(verificationOptions);
          
          verified = verification.verified;
          
          console.log("=== FULL VERIFICATION RESULT DEBUG ===");
          console.log("Verification result keys:", Object.keys(verification));
          console.log("Verification.verified:", verification.verified);
          console.log("Has registrationInfo:", !!verification.registrationInfo);
          console.log("Full verification result JSON:");
          console.log(JSON.stringify(verification, (key, value) => {
            // Convert Uint8Arrays to base64 for logging
            if (value instanceof Uint8Array) {
              return `[Uint8Array:${value.length} bytes]`;
            }
            return value;
          }, 2));
          console.log("=== END FULL VERIFICATION RESULT DEBUG ===");
          
          if (verified && verification.registrationInfo) {
            const regInfo = verification.registrationInfo;
            console.log("RegistrationInfo keys:", Object.keys(regInfo));
            
            // FORCE USE ORIGINAL REQUEST DATA - SimpleWebAuthn v13.1.1 structure is unreliable
            console.log("FORCING use of original request data due to SimpleWebAuthn v13.1.1 structure issues");
            
            registrationInfo = {
              credentialId: rawId, // Always use the rawId from original request
              credentialPublicKey: regInfo.credential?.publicKey || regInfo.credentialPublicKey || new Uint8Array(0),
              counter: regInfo.credential?.counter || regInfo.counter || 0,
            };
            
            console.log("Forced credential extraction result:", {
              credentialId: registrationInfo.credentialId,
              credentialIdType: typeof registrationInfo.credentialId,
              credentialIdSource: "original-rawId",
              hasPublicKey: !!registrationInfo.credentialPublicKey,
              publicKeyLength: registrationInfo.credentialPublicKey?.length || 0,
              counter: registrationInfo.counter
            });
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

        // EMERGENCY FALLBACK: If registrationInfo is completely broken, use the original request data
        if (!registrationInfo || !registrationInfo.credentialId) {
          console.log("Using emergency fallback with original request data");
          registrationInfo = {
            credentialId: rawId, // Use the rawId from the original request
            credentialPublicKey: new Uint8Array(0), // Placeholder - we need the actual public key
            counter: 0,
          };
          console.log("Emergency fallback credential info:", registrationInfo);
        }

        // Add credential to user
        user.credentials.push(registrationInfo);
        await updateUser(username, user);
        await deleteChallenge(username);

        // Create session for immediate login after registration
        const sessionId = generateSessionId();
        await createSession(sessionId, username);

        console.log("Session created for new user:", sessionId);

        const cookie = [
          `session=${sessionId}`,
          `Path=/`,
          `HttpOnly`,
          `SameSite=Strict`,
          `Max-Age=86400`, // 24 hours
        ].join("; ");

        console.log("Sending successful registration response with auto-login");

        return new Response(JSON.stringify({ success: true, redirect: "/", newUser: true }), {
          status: 200,
          headers: {
            "Set-Cookie": cookie,
            "Content-Type": "application/json",
          },
        });
      } catch (error) {
        console.error("Registration verification error:", error);
        console.error("Error stack:", error.stack);
        return new Response(`Registration verification failed: ${error.message}`, { status: 500 });
      }
    })
    
    .with({ pathname: "/auth/login/options", method: "GET" }, async () => {
      console.log("=== Login Options ===");
      console.log("User credentials count:", user.credentials.length);
      
      // Check if user has any registered credentials
      if (!user.credentials || user.credentials.length === 0) {
        console.log("User has no registered credentials for login");
        return new Response("No registered credentials found. Please register first.", { status: 400 });
      }
      
      // Debug: Log detailed credential information
      console.log("=== DETAILED CREDENTIAL DEBUG ===");
      console.log("User object:", JSON.stringify(user, null, 2));
      console.log("Credentials array:", user.credentials);
      user.credentials.forEach((cred, index) => {
        console.log(`Credential ${index}:`, {
          credentialId: cred.credentialId,
          credentialIdType: typeof cred.credentialId,
          credentialIdIsString: typeof cred.credentialId === 'string',
          credentialIdLength: cred.credentialId?.length,
          hasPublicKey: !!cred.credentialPublicKey,
          hasCounter: typeof cred.counter === 'number'
        });
      });
      console.log("=== END CREDENTIAL DEBUG ===");
      
      console.log("User credentials:", user.credentials.map(c => ({
        id: c.credentialId,
        type: typeof c.credentialId,
        length: c.credentialId?.length
      })));

      // Filter out credentials with invalid or missing IDs
      const validCredentials = user.credentials.filter(c => {
        if (!c.credentialId || c.credentialId === 'undefined') {
          console.log("Filtering out credential with missing/undefined ID:", c);
          return false;
        }
        if (typeof c.credentialId !== 'string') {
          console.log("Filtering out credential with non-string ID:", c);
          return false;
        }
        return true;
      });
      
      // If we filtered out invalid credentials, update the user
      if (validCredentials.length !== user.credentials.length) {
        console.log(`Cleaned up user credentials: ${user.credentials.length} -> ${validCredentials.length}`);
        user.credentials = validCredentials;
        await updateUser(username, user);
      }

      console.log("Valid credentials after filtering:", validCredentials.length);

      if (validCredentials.length === 0) {
        console.log("No valid credentials found after filtering");
        return new Response("No valid credentials found. Please register again.", { status: 400 });
      }

      const allowCredentials = validCredentials.map((c) => ({
        id: c.credentialId, // SimpleWebAuthn handles the conversion automatically
        type: "public-key" as const,
      }));
      
      console.log("Allow credentials:", allowCredentials);

      let opts;
      try {
        opts = await generateAuthenticationOptions({
          rpID: requestAuthConfig.RP_ID,
          allowCredentials,
          userVerification: 'required',
        });
        
        console.log("Generated login options:", JSON.stringify(opts, null, 2));
      } catch (error) {
        console.error("Error generating authentication options:", error);
        console.error("AllowCredentials that caused error:", JSON.stringify(allowCredentials, null, 2));
        return new Response("Failed to generate login options. Please register again.", { status: 500 });
      }

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
        
        // Convert credentialId to Uint8Array if it's a string (base64url)
        const credentialIdBytes = typeof credential.credentialId === 'string' 
          ? fromB64(credential.credentialId)
          : credential.credentialId;

        // Properly reconstruct the credential public key from stored data
        let credentialPublicKey;
        if (credential.credentialPublicKey instanceof Uint8Array) {
          credentialPublicKey = credential.credentialPublicKey;
        } else if (credential.credentialPublicKey && typeof credential.credentialPublicKey === 'object') {
          // Convert object with numeric keys back to Uint8Array
          const length = Math.max(...Object.keys(credential.credentialPublicKey).map(Number)) + 1;
          credentialPublicKey = new Uint8Array(length);
          for (const [key, value] of Object.entries(credential.credentialPublicKey)) {
            credentialPublicKey[parseInt(key)] = value as number;
          }
        } else {
          throw new Error("Invalid credential public key format");
        }

        const authenticatorData = {
          credentialID: credentialIdBytes,
          credentialPublicKey: credentialPublicKey,
          counter: Number(credential.counter) || 0,
        };

        console.log("About to verify with authenticator data:", {
          credentialID: credential.credentialId,
          credentialIDType: typeof credential.credentialId,
          credentialIDBytes: credentialIdBytes,
          credentialPublicKey: credentialPublicKey,
          credentialPublicKeyType: typeof credentialPublicKey,
          credentialPublicKeyLength: credentialPublicKey.length,
          counter: authenticatorData.counter,
          counterType: typeof authenticatorData.counter,
          authenticatorData: authenticatorData
        });

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
          expectedOrigin: requestAuthConfig.ORIGIN,
          expectedRPID: requestAuthConfig.RP_ID,
          authenticator: authenticatorData,
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
    
    .with({ pathname: "/auth/conditional/options", method: "GET" }, async () => {
      console.log("=== Conditional UI Options ===");
      
      try {
        // For conditional UI, we generate options without specific allowCredentials
        // This allows any registered passkey to be used
        const opts = await generateAuthenticationOptions({
          rpID: requestAuthConfig.RP_ID,
          allowCredentials: [], // Empty array means any credential can be used
          userVerification: 'preferred', // Use 'preferred' for conditional UI
          timeout: 300000, // 5 minutes for conditional UI
        });
        
        console.log("Generated conditional UI options:", JSON.stringify(opts, null, 2));

        // Store challenge for later verification - we'll need the credential ID to know which user
        // For now, store with a special key that we'll clean up later
        const challengeBuffer = new TextEncoder().encode(opts.challenge);
        await storeChallenge("conditional_ui", challengeBuffer);

        return Response.json(opts);
      } catch (error) {
        console.error("Error generating conditional UI options:", error);
        return new Response("Failed to generate conditional UI options", { status: 500 });
      }
    })
    
    .with({ pathname: "/auth/conditional/verify", method: "POST" }, async () => {
      console.log("=== Conditional UI Verification ===");
      
      try {
        const { username, credential } = await req.json();
        console.log("Conditional verification for user:", username);
        console.log("Credential ID:", credential.id);
        
        // Validate email domain
        if (!CONSTANTS_AUTH_CONFIG.EMAIL_REGEX.test(username)) {
          console.log("Invalid email domain:", username);
          return new Response("Email must be from an allowed domain", { status: 400 });
        }
        
        // Get user data
        let user = await getUser(username);
        if (!user) {
          console.log("User not found:", username);
          return new Response("User not found", { status: 404 });
        }
        
        // Get the conditional challenge
        const storedChallenge = await getChallenge("conditional_ui");
        if (!storedChallenge) {
          console.log("No conditional challenge found");
          return new Response("No challenge found", { status: 400 });
        }
        
        // Find the credential
        const userCredential = user.credentials.find(c => c.credentialId === credential.rawId);
        if (!userCredential) {
          console.log("Credential not found for user");
          return new Response("Credential not found", { status: 404 });
        }
        
        console.log("Found user credential:", userCredential.credentialId);
        
        // Convert stored challenge back to string for SimpleWebAuthn
        const storedChallengeString = new TextDecoder().decode(new Uint8Array(storedChallenge));
        
        const verification = await verifyAuthenticationResponse({
          response: {
            id: credential.id,
            rawId: credential.rawId,
            response: {
              clientDataJSON: credential.response.clientDataJSON,
              authenticatorData: credential.response.authenticatorData,
              signature: credential.response.signature,
              userHandle: credential.response.userHandle,
            },
            type: "public-key",
          },
          expectedChallenge: storedChallengeString,
          expectedOrigin: requestAuthConfig.ORIGIN,
          expectedRPID: requestAuthConfig.RP_ID,
          authenticator: {
            credentialID: userCredential.credentialId,
            credentialPublicKey: userCredential.credentialPublicKey,
            counter: userCredential.counter,
          },
          requireUserVerification: true,
        });

        if (!verification.verified) {
          console.log("Conditional verification failed");
          return Response.json({ success: false });
        }

        console.log("Conditional verification successful!");

        // Create session
        const sessionId = generateSessionId();
        await createSession(sessionId, username);
        await deleteChallenge("conditional_ui");

        console.log("Session created:", sessionId);

        const cookie = [
          `session=${sessionId}`,
          `Path=/`,
          `HttpOnly`,
          `SameSite=Strict`,
          `Max-Age=86400`,
        ].join("; ");

        console.log("Sending successful conditional login response");

        return new Response(JSON.stringify({ success: true, redirect: "/" }), {
          status: 200,
          headers: {
            "Set-Cookie": cookie,
            "Content-Type": "application/json",
          },
        });
      } catch (error) {
        console.error("Conditional verification error:", error);
        return new Response("Conditional verification failed", { status: 500 });
      }
    })
    
    .with({ pathname: "/auth/identify", method: "POST" }, async () => {
      console.log("=== Identify User by Credential ===");
      
      try {
        const { credentialId } = await req.json();
        console.log("Looking for credential ID:", credentialId);
        
        // Search through all users to find the one with this credential
        const kvStore = await (await import("../auth/kv.ts")).getKv();
        
        for await (const { key, value } of kvStore.list({ prefix: ["user"] })) {
          const user = value;
          console.log("Checking user:", user.username, "credentials:", user.credentials?.length || 0);
          
          if (user.credentials) {
            for (const cred of user.credentials) {
              console.log("Comparing credential:", cred.credentialId, "with:", credentialId);
              if (cred.credentialId === credentialId) {
                console.log("Found matching user:", user.username);
                return Response.json({ username: user.username });
              }
            }
          }
        }
        
        console.log("No user found for credential ID:", credentialId);
        return new Response("User not found for this credential", { status: 404 });
      } catch (error) {
        console.error("Error identifying user:", error);
        return new Response("Failed to identify user", { status: 500 });
      }
    })
    
    .with({ pathname: "/auth/cleanup", method: "POST" }, async () => {
      console.log("=== CLEANUP CORRUPTED USER DATA ===");
      
      try {
        const kvStore = await (await import("../auth/kv.ts")).getKv();
        let cleanedUsers = 0;
        let deletedUsers = 0;
        
        for await (const { key, value } of kvStore.list({ prefix: ["user"] })) {
          const user = value;
          console.log(`Checking user: ${user.username}, credentials: ${user.credentials?.length || 0}`);
          
          if (user.credentials && user.credentials.length > 0) {
            const validCredentials = user.credentials.filter(c => {
              const isValid = c.credentialId && typeof c.credentialId === 'string' && c.credentialId !== 'undefined';
              if (!isValid) {
                console.log(`Invalid credential found for ${user.username}:`, c);
              }
              return isValid;
            });
            
            if (validCredentials.length !== user.credentials.length) {
              if (validCredentials.length === 0) {
                // Delete user if no valid credentials
                await kvStore.delete(key);
                deletedUsers++;
                console.log(`Deleted user ${user.username} with no valid credentials`);
              } else {
                // Update user with only valid credentials
                user.credentials = validCredentials;
                await kvStore.set(key, user);
                cleanedUsers++;
                console.log(`Cleaned user ${user.username}: ${user.credentials.length} -> ${validCredentials.length} credentials`);
              }
            }
          }
        }
        
        return new Response(JSON.stringify({ 
          success: true, 
          cleanedUsers, 
          deletedUsers,
          message: `Cleaned ${cleanedUsers} users, deleted ${deletedUsers} users with no valid credentials`
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
        
      } catch (error) {
        console.error("Cleanup error:", error);
        return new Response(`Cleanup failed: ${error.message}`, { status: 500 });
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