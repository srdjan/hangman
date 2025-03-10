# Hangman Monorepo

A monorepo containing multiple applications, starting with the classic Hangman word guessing game.

## Applications

### Hangman Game

A modern web-based implementation of the classic Hangman word guessing game with a focus on web development-related words.

### Example App

A simple example application demonstrating how to use shared packages in the monorepo.

#### Features

- Three difficulty levels (easy, medium, hard)
- Server-side game state management
- Responsive design for desktop and mobile
- Keyboard support for letter inputs
- Visual hangman representation using SVG
- Session-based gameplay

## Technologies

- **Backend**
  - [Deno](https://deno.land/) - A secure JavaScript/TypeScript runtime
  - TypeScript with strict typing
  - Server-side session management
  - RESTful HTTP endpoints

- **Frontend**
  - HTML with dynamic templating
  - CSS for responsive styling
  - HTMX for AJAX interactions

## Project Structure

```
hangman-monorepo/
├── packages/
│   ├── apps/            # All applications
│   │   ├── hangman/     # Hangman game application
│   │   │   ├── main.ts              # Entry point that sets up HTTP server and routes
│   │   │   ├── index.html           # Main HTML template
│   │   │   ├── routes/              # Request routing and handling
│   │   │   │   ├── handlers.ts      # HTTP request handlers
│   │   │   │   └── router.ts        # URL pattern matching and routing
│   │   │   ├── state/               # Game state management
│   │   │   │   ├── game.ts          # Game logic and state management
│   │   │   │   └── session.ts       # User session handling
│   │   │   ├── utils/               # Application-specific utilities
│   │   │   │   ├── array.ts         # Array helper functions
│   │   │   │   ├── pattern.ts       # Pattern matching utilities
│   │   │   │   └── result.ts        # Result type for error handling
│   │   │   ├── views/               # HTML rendering
│   │   │   │   └── templates.ts     # HTML template generation
│   │   │   ├── static/              # Static assets
│   │   │   │   └── styles.css       # CSS styling
│   │   │   └── types.ts             # TypeScript type definitions
│   │   └── example/     # Example application
│   │       ├── main.ts              # Entry point for example app
│   │       └── deno.json            # Example app configuration
│   └── shared/          # Shared packages used across applications
│       └── utils/       # Shared utility functions
│           ├── mod.ts               # Entry point for shared utilities
│           ├── array.ts             # Array utilities
│           └── result.ts            # Result type for error handling
├── deno.json            # Root configuration file
└── README.md            # This file
```

## How to Play

1. Start a new game by choosing a difficulty level
2. Guess letters by clicking on the virtual keyboard or using your physical keyboard
3. Try to guess the word before the hangman is completely drawn
4. Correct guesses reveal the letter in the word
5. Incorrect guesses draw parts of the hangman

## Running Projects

### Prerequisites

- [Deno](https://deno.land/) (version 1.32.0 or higher)

### Installation & Running

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/hangman-monorepo.git
   cd hangman-monorepo
   ```

2. Run an application development server
   ```bash
   # For Hangman app
   deno task dev:hangman
   
   # For Example app
   deno task dev:example
   ```

3. Open your browser and visit:
   - Hangman app: http://localhost:8000
   - Example app: http://localhost:8001

### Adding New Applications

To add a new application to the monorepo:

1. Create a new directory in `packages/apps/`
2. Add the new app's files and configuration
3. Update the root deno.json to include a task for running the new app
4. Leverage shared packages from `packages/shared/`

## Deploying Applications

To deploy applications to Deno Deploy, you can use the following tasks:

```bash
# Deploy the Hangman application
deno task deploy:hangman

# Deploy the Example application
deno task deploy:example

# Deploy all applications in one go
deno task deploy:all
```

## Deployment

### Deno Deploy

Applications in this monorepo can be deployed using [Deno Deploy](https://deno.com/deploy), a serverless hosting platform for Deno applications.

#### Deployment Process

1. Create a Deno Deploy account at https://deno.com/deploy

2. Install the Deno Deploy CLI (if not already installed)
   ```bash
   deno install -A --no-check -r -f https://deno.land/x/deploy/deployctl.ts
   ```

3. Create a project for each application in the Deno Deploy dashboard

4. Deploy the applications using the provided tasks:
   ```bash
   # Deploy a specific application
   deno task deploy:hangman
   deno task deploy:example
   
   # Or deploy all applications
   deno task deploy:all
   ```

5. The `--save-config` flag ensures that any deployment settings are saved to the app's `deno.json` file, preventing configuration warnings.

6. Alternatively, you can set up GitHub integration for continuous deployment through the Deno Deploy dashboard.

#### Application URLs

After deployment, your applications will be available at:
- Hangman app: `https://hangman.deno.dev`
- Example app: `https://example-app.deno.dev`

#### Adding Deployment for New Apps

When adding a new application to the monorepo:

1. Create a deployment directory with its own standalone structure:
   ```bash
   mkdir -p deploy/your-app
   ```

2. Create a completely self-contained `main.ts` file in the deployment directory:
   ```typescript
   // deploy/your-app/main.ts
   import * as effection from "jsr:@effection/effection@^3.1.0";
   import { match } from "jsr:@gabriel/ts-pattern@^5.6.2";
   
   // Include all necessary types, functions, handlers, and templates
   // directly in this file instead of importing from the monorepo
   
   // Do not use relative imports from the monorepo structure
   // Copy all required code into this single file
   
   // Run the server with effection
   effection.main(runServer);
   ```

3. Create a `deno.json` file in the deployment directory:
   ```json
   {
     "imports": {
       "@gabriel/ts-pattern": "jsr:@gabriel/ts-pattern@^5.6.2",
       "@std/assert": "jsr:@std/assert@1",
       "@effection/effection": "jsr:@effection/effection@^3.1.0"
     },
     "tasks": {
       "start": "deno run --allow-net --allow-read main.ts"
     }
   }
   ```

4. Add the directory to the workspace in the root `deno.json`:
   ```json
   "workspace": {
     "members": [
       "packages/apps/*",
       "packages/shared/*",
       "deploy/*"
     ]
   }
   ```

5. Add a deployment task to the root `deno.json`:
   ```json
   "deploy:your-app": "cd deploy/your-app && deno check main.ts && deployctl deploy --project=your-project-name --allow-net --allow-read ."
   ```

6. Update the `deploy:all` task to include your new app.

## License

MIT