# Hangman Game

A modern web-based implementation of the classic Hangman word guessing game with a focus on web development-related words.

## Features

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
hangman/
├── main.ts              # Entry point that sets up HTTP server and routes
├── index.html           # Main HTML template
├── routes/              # Request routing and handling
│   ├── handlers.ts      # HTTP request handlers
│   └── router.ts        # URL pattern matching and routing
├── state/               # Game state management
│   ├── game.ts          # Game logic and state management
│   └── session.ts       # User session handling
├── utils/               # Utility functions
│   ├── array.ts         # Array helper functions
│   ├── pattern.ts       # Pattern matching utilities
│   └── result.ts        # Result type for error handling
├── views/               # HTML rendering
│   └── templates.ts     # HTML template generation
├── static/              # Static assets
│   └── styles.css       # CSS styling
└── types.ts             # TypeScript type definitions
```

## How to Play

1. Start a new game by choosing a difficulty level
2. Guess letters by clicking on the virtual keyboard or using your physical keyboard
3. Try to guess the word before the hangman is completely drawn
4. Correct guesses reveal the letter in the word
5. Incorrect guesses draw parts of the hangman

## Running the Project

### Prerequisites

- [Deno](https://deno.land/) (version 1.32.0 or higher)

### Installation & Running

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/hangman.git
   cd hangman
   ```

2. Run the development server
   ```bash
   deno task dev
   ```

3. Open your browser and visit http://localhost:8000

## Creating a Production Build

```bash
deno task build
```

## Deployment

### Deno Deploy

This project can be easily deployed using [Deno Deploy](https://deno.com/deploy), a serverless hosting platform for Deno applications.

1. Create a Deno Deploy account at https://deno.com/deploy

2. Install the Deno Deploy CLI (if not already installed)
   ```bash
   deno install -A --no-check -r -f https://deno.land/x/deploy/deployctl.ts
   ```

3. Configure deployment
   Create a `deploy.json` file:
   ```json
   {
     "project": "hangman",
     "entrypoint": "main.ts",
     "include": ["routes", "state", "utils", "views", "static", "types.ts", "index.html"]
   }
   ```

4. Deploy your application
   ```bash
   deployctl deploy --project=hangman main.ts
   ```

5. Alternatively, you can set up GitHub integration for continuous deployment through the Deno Deploy dashboard.

Your application will be available at `https://hangman.deno.dev`

## License

MIT