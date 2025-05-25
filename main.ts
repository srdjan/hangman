// This file is used as the entrypoint for Deno Deploy

// Import dependencies using direct URLs for Deno Deploy
import * as effection from "jsr:@effection/effection";
import { createRouter } from "./src/routes/router.ts";
import { gameHandler, newGameHandler, guessHandler, hintHandler, staticFileHandler, twoPlayerGameHandler, newTwoPlayerGameHandler, twoPlayerGuessHandler } from "./src/routes/handlers.ts";

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
    { path: "/", handler: gameHandler },
    { path: "/new-game", handler: newGameHandler },
    { path: "/guess/:letter", handler: guessHandler },
    { path: "/hint", handler: hintHandler },
    { path: "/two-player", handler: twoPlayerGameHandler },
    { path: "/two-player/new-game", handler: newTwoPlayerGameHandler },
    { path: "/two-player/guess/:letter", handler: twoPlayerGuessHandler },
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
        return await router(req, path);
      } catch (error) {
        console.error("Server error:", error);
        return new Response("Server error", { status: 500 });
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
