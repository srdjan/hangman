// This file is used as the entrypoint for Deno Deploy

// Import dependencies using direct URLs for Deno Deploy
import * as effection from "jsr:@effection/effection";
import { createRouter } from "./src/routes/router.ts";
import { gameHandler, newGameHandler, guessHandler, hintHandler, staticFileHandler } from "./src/routes/handlers.ts";
import { authHandler } from "./src/routes/auth.ts";
import { requireAuth } from "./src/middleware/auth.ts";
import { rateLimit, securityHeaders } from "./src/middleware/rateLimiting.ts";
import { loginPage } from "./src/views/auth.ts";

// Protected route handlers
const protectedGameHandler = async (request: Request, params: Record<string, string>): Promise<Response> => {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) {
    return authResult; // Redirect to login
  }
  return gameHandler(request, params, authResult);
};

const protectedNewGameHandler = async (request: Request, params: Record<string, string>): Promise<Response> => {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) {
    return authResult; // Redirect to login
  }
  return newGameHandler(request, authResult);
};

const protectedGuessHandler = async (request: Request, params: Record<string, string>): Promise<Response> => {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) {
    return authResult; // Redirect to login
  }
  return guessHandler(request, params, authResult);
};

const protectedHintHandler = async (request: Request, params: Record<string, string>): Promise<Response> => {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) {
    return authResult; // Redirect to login
  }
  return hintHandler(request, authResult);
};

// Auth route handlers
const loginHandler = async (request: Request, params: Record<string, string>): Promise<Response> => {
  return new Response(loginPage(), {
    headers: { "Content-Type": "text/html" },
  });
};

const authRouteHandler = async (request: Request, params: Record<string, string>): Promise<Response> => {
  return authHandler(request);
};

// Setup SIGINT (CTRL+C) handling for clean shutdown
function setupSignalHandlers(cb: () => void) {
  try {
    Deno.addSignalListener("SIGINT", () => {
      console.log("\nReceived SIGINT signal");
      cb();
    });
  } catch (error) {
    console.error("Failed to setup signal handlers:", error);
  }
}

// Define the main function
const runServer = function* () {
  const router = createRouter([
    { path: "/", handler: protectedGameHandler },
    { path: "/new-game", handler: protectedNewGameHandler },
    { path: "/guess/:letter", handler: protectedGuessHandler },
    { path: "/hint", handler: protectedHintHandler },
    { path: "/login", handler: loginHandler },
    { path: "/auth/register/options", handler: authRouteHandler },
    { path: "/auth/register/verify", handler: authRouteHandler },
    { path: "/auth/login/options", handler: authRouteHandler },
    { path: "/auth/login/verify", handler: authRouteHandler },
    { path: "/auth/conditional/options", handler: authRouteHandler },
    { path: "/auth/conditional/verify", handler: authRouteHandler },
    { path: "/auth/identify", handler: authRouteHandler },
    { path: "/auth/logout", handler: authRouteHandler },
    { path: "/static/*", handler: staticFileHandler },
  ]);

  const controller = new AbortController();
  const signal = controller.signal;

  try {
    // Setup signal handlers outside effection for clean shutdown
    setupSignalHandlers(() => {
      console.log("Gracefully shutting down server...");
      controller.abort();
    });

    // Start the server
    const port = Deno.env.get("PORT") ? parseInt(Deno.env.get("PORT") || "8001") : 8001;
    console.log(`Hangman server running on port ${port}`);
    const server = Deno.serve({ port, signal }, async (req: Request) => {
      const url = new URL(req.url);
      const path = url.pathname;

      try {
        let rateLimitHeaders: Record<string, string> | undefined;
        
        // Apply rate limiting to auth routes
        if (path.startsWith("/auth/")) {
          const rateLimitResult = await rateLimit(req);
          if (rateLimitResult.response) {
            return await securityHeaders(rateLimitResult.response);
          }
          rateLimitHeaders = rateLimitResult.rateLimitHeaders;
        }

        const response = await router(req, path);
        return await securityHeaders(response, rateLimitHeaders);
      } catch (error) {
        console.error("Server error:", error);
        const errorResponse = new Response("Server error", { status: 500 });
        return await securityHeaders(errorResponse);
      }
    });

    // Create a task to monitor the abort signal
    yield* effection.spawn(function* () {
      try {
        while (true) {
          if (signal.aborted) break;
          yield* effection.sleep(100);
        }
        console.log("Abort signal detected, cleaning up...");
      } catch (error) {
        console.error("Error in signal monitor:", error);
      }
    });

    // Wait for server to complete naturally or be aborted
    while (!signal.aborted) {
      yield* effection.sleep(1000);
    }

    // Server cleanup
    try {
      server.shutdown();

      // Clean up signal handlers
      Deno.removeSignalListener("SIGINT", () => { });
    } catch (error) {
      console.error("Error during cleanup:", error);
    }
  } catch (error) {
    console.error("Critical server error:", error);
  } finally {
    console.log("Server has been shut down");
  }
};

// Run the server with effection
if (import.meta.main) {
  effection.main(runServer);
}

// Export for Deno Deploy
export default runServer;
