// This is a standalone deployment entry point for the Example app
// It imports the main application from its location in the monorepo

import { main as runExampleApp } from "./packages/apps/example/main.ts";

// Re-export the main function
export default runExampleApp;