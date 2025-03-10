// This is a standalone deployment entry point for the Hangman app
// It imports the main application from its location in the monorepo

import { main as runServer } from "./packages/apps/hangman/main.ts";

// Re-export the main function
export default runServer;