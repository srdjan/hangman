// Deployment entry point for Deno Deploy
// This file uses direct URLs instead of import maps

// Import dependencies using direct URLs
import { createRouter } from "./src/routes/router.ts";
import {
  gameHandler,
  newGameHandler,
  guessHandler,
  hintHandler,
  staticFileHandler
} from "./src/routes/handlers.ts";

// Simple pattern matching implementation for deployment
// Export it so it can be used by imported modules
export function match<T>(value: T) {
  return {
    with<R>(pattern: T, handler: () => R): { otherwise<O>(defaultHandler: () => O): R | O } {
      const matched = value === pattern;
      return {
        otherwise<O>(defaultHandler: () => O): R | O {
          return matched ? handler() : defaultHandler();
        }
      };
    },
    otherwise<O>(defaultHandler: () => O): O {
      return defaultHandler();
    }
  };
}

// Define the main function
function startServer() {
  const router = createRouter([
    { path: "/", handler: gameHandler },
    { path: "/new-game", handler: newGameHandler },
    { path: "/guess/:letter", handler: guessHandler },
    { path: "/hint", handler: hintHandler },
    { path: "/static/*", handler: staticFileHandler },
  ]);

  // Start the server
  const port = Deno.env.get("PORT") ? parseInt(Deno.env.get("PORT") || "8001") : 8001;
  console.log(`Hangman server running on port ${port}`);

  // Use the current serve API
  const handler = async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const path = url.pathname;

    try {
      return await router(req, path);
    } catch (error) {
      console.error("Server error:", error);
      return new Response("Server error", { status: 500 });
    }
  };

  Deno.serve({ port }, handler);
}

// Start the server
if (import.meta.main) {
  startServer();
}
