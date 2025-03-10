import * as effection from "@effection/effection";
import { getRandomElement } from "@hangman/shared/utils";

// Example application demonstrating monorepo shared code usage
const runExampleApp = function*() {
  console.log("Example application is running!");
  
  // Using shared utilities
  const result = getRandomElement(["apple", "banana", "cherry", "date"]);
  
  if (result.ok) {
    console.log(`Random fruit: ${result.value}`);
  } else {
    console.error(`Error: ${result.error.message}`);
  }
  
  try {
    const server = Deno.serve({ port: 8001 }, () => {
      return new Response("Example App Running");
    });
    
    console.log("Server running at http://localhost:8001/");
    
    // Keep the server running
    while (true) {
      yield* effection.sleep(1000);
    }
  } catch (error) {
    console.error("Error:", error);
  }
};

// Export the app function for deployment
export const main = runExampleApp;

// Run the app with effection if this file is executed directly
if (import.meta.main) {
  effection.main(runExampleApp);
}