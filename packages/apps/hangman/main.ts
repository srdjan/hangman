import { createRouter } from "./routes/router.ts";
import { gameHandler, newGameHandler, guessHandler, hintHandler, staticFileHandler } from "./routes/handlers.ts";
import * as effection from "@effection/effection";

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
    // No need to capture the return value

    // Start the server
    const port = 8001;
    console.log(`Hangman server running at http://localhost:${port}/`);
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

// Export the server function for deployment
export const main = runServer;

// Run the server with effection if this file is executed directly
if (import.meta.main) {
  effection.main(runServer);
}