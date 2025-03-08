import { createRouter } from "./routes/router.ts";
import { gameHandler, newGameHandler, guessHandler, staticFileHandler } from "./routes/handlers.ts";

const router = createRouter([
  { path: "/", handler: gameHandler },
  { path: "/new-game", handler: newGameHandler },
  { path: "/guess/:letter", handler: guessHandler },
  { path: "/static/*", handler: staticFileHandler },
]);

Deno.serve({ port: 8000 }, async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname;

  try {
    return await router(req, path);
  } catch (error) {
    console.error("Server error:", error);
    return new Response("Server error", { status: 500 });
  }
});

console.log("Hangman server running at http://localhost:8000/");