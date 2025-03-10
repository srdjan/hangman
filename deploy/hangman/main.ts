// Self-contained deployment file with everything needed for the hangman app
import * as effection from "jsr:@effection/effection@^3.1.0";
import { match } from "jsr:@gabriel/ts-pattern@^5.6.2";

// Types
type GameStatus = "playing" | "won" | "lost";
type Difficulty = "easy" | "medium" | "hard";

interface GameState {
  word: string;
  guessedLetters: Set<string>;
  wrongGuesses: number;
  status: GameStatus;
  difficulty: Difficulty;
}

interface Route {
  path: string;
  handler: (req: Request, params?: Record<string, string>) => Promise<Response>;
}

// UTILITY FUNCTIONS
/**
 * Result<T, E> - Type-safe representation of operations that can succeed or fail
 */
type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/**
 * Create a successful result
 */
const ok = <T>(value: T): Result<T> => ({
  ok: true,
  value
});

/**
 * Create a failed result
 */
const err = <E = Error>(error: E): Result<never, E> => ({
  ok: false,
  error
});

/**
 * Get the value from a Result or return a default
 */
const unwrapOr = <T, E>(result: Result<T, E>, defaultValue: T): T =>
  result.ok ? result.value : defaultValue;

// Type-safe random element selection with proper error handling
const getRandomElement = <T>(array: readonly T[]): Result<T, Error> => {
  if (array.length === 0) {
    return err(new Error("Cannot select from empty collection"));
  }

  const index = Math.floor(Math.random() * array.length);
  const element = array[index];

  // Explicit narrowing for type safety
  if (element === undefined) {
    return err(new Error(`Index access failed at position ${index}`));
  }

  return ok(element);
};

// ROUTER
// Create a simple router that matches path patterns
function createRouter(routes: Route[]) {
  return async (request: Request, path: string): Promise<Response> => {
    for (const route of routes) {
      const params: Record<string, string> = {};
      
      // Convert route pattern to regex for matching
      const pattern = route.path.replace(/:[^\\/]+/g, "([^\\/]+)").replace(/\\*/g, ".*");
      const regex = new RegExp(`^${pattern}$`);
      
      const match = path.match(regex);
      
      if (match) {
        // Extract named parameters
        const paramNames = Array.from(route.path.matchAll(/:([^\\/]+)/g)).map(m => m[1]);
        paramNames.forEach((name, i) => {
          params[name] = match[i + 1];
        });
        
        return route.handler(request, params);
      }
    }
    
    return new Response("Not found", { status: 404 });
  };
}

// WORD LISTS
const EASY_WORDS = [
  "HTML", "CSS", "DIV", "SPAN", "CODE", "TAG", "WEB", "HTTP", "DOM", "API",
  "LINK", "HEAD", "BODY", "FONT", "TEXT", "STYLE", "CLASS", "JAVA", "PHP"
];

const MEDIUM_WORDS = [
  "JAVASCRIPT", "TYPESCRIPT", "REACT", "ANGULAR", "VUEJS", "JQUERY", "PYTHON",
  "FRONTEND", "BACKEND", "DATABASE", "PROMISE", "FUNCTION", "VARIABLE",
  "COMPONENT", "INTERFACE", "MODULE", "SERVER", "CLIENT", "ROUTER"
];

const HARD_WORDS = [
  "ASYNCHRONOUS", "AUTHENTICATION", "AUTHORIZATION", "WEBPACK", "KUBERNETES",
  "MICROSERVICE", "ALGORITHM", "ENCRYPTION", "RECURSION", "MIDDLEWARE",
  "DEPENDENCY", "FRAMEWORK", "ARCHITECTURE", "OPTIMIZATION", "REFACTORING"
];

// GAME STATE MANAGEMENT
let sessions: Record<string, GameState> = {};

function createSession(gameState: GameState): string {
  const sessionId = crypto.randomUUID();
  sessions[sessionId] = gameState;
  return sessionId;
}

function getSession(sessionId: string): GameState | undefined {
  return sessions[sessionId];
}

function setSession(sessionId: string, gameState: GameState): void {
  sessions[sessionId] = gameState;
}

function createGame(difficulty: Difficulty = "medium"): Result<GameState, Error> {
  const wordSource = match(difficulty)
    .with("easy", () => EASY_WORDS)
    .with("medium", () => MEDIUM_WORDS)
    .with("hard", () => HARD_WORDS)
    .exhaustive();

  const wordResult = getRandomElement(wordSource);
  
  if (!wordResult.ok) {
    return wordResult;
  }

  const gameState: GameState = {
    word: wordResult.value,
    guessedLetters: new Set<string>(),
    wrongGuesses: 0,
    status: "playing",
    difficulty
  };

  return ok(gameState);
}

function getDisplayWord(state: GameState): Result<string[], Error> {
  try {
    const displayLetters = Array.from(state.word).map(letter => 
      state.guessedLetters.has(letter) ? letter : "_"
    );
    
    return ok(displayLetters);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

function processGuess(state: GameState, letter: string): Result<GameState, Error> {
  if (state.status !== "playing") {
    return ok(state); // Game already finished
  }

  // Already guessed this letter
  if (state.guessedLetters.has(letter)) {
    return ok(state);
  }

  // Clone the current state
  const newState: GameState = {
    ...state,
    guessedLetters: new Set(state.guessedLetters)
  };
  
  // Add the guessed letter
  newState.guessedLetters.add(letter);
  
  // Check if the letter is in the word
  if (!state.word.includes(letter)) {
    newState.wrongGuesses += 1;
    
    // Check for loss condition (7 wrong guesses)
    if (newState.wrongGuesses >= 7) {
      newState.status = "lost";
    }
  } else {
    // Check for win condition (all letters guessed)
    const isWin = Array.from(state.word).every(char => 
      newState.guessedLetters.has(char)
    );
    
    if (isWin) {
      newState.status = "won";
    }
  }
  
  return ok(newState);
}

// TEMPLATES
const baseTemplate = (content: string): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Secure Hangman Game</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/htmx.org@1.9.6" integrity="sha384-FhXw7b6AlE/jyjlZH5iHa/tTe9EpJ1Y55RjcgPbjeWMskSxZt1v9qkxLJWNJaGni" crossorigin="anonymous"></script>
  <style>
  ${getCSS()}
  </style>
  <script>
    // Debug HTMX events
    document.addEventListener('htmx:beforeSwap', function(evt) {
      console.log('htmx:beforeSwap', evt);
    });
    document.addEventListener('htmx:afterSwap', function(evt) {
      console.log('htmx:afterSwap', evt);
    });
    document.addEventListener('htmx:responseError', function(evt) {
      console.log('htmx:responseError', evt);
    });
  </script>
</head>
<body>
  <header>
  </header>
  
  ${content}
  
  <footer>
    <p>Cooked with ❤️ by <a href="https://srdjan.github.io" target="_blank" rel="noopener noreferrer">⊣˚∆˚⊢</a></p>
  </footer>
</body>
</html>
`;

const gameComponent = (state: GameState): string => `
<div class="game-container" id="game-container">
  <!-- Difficulty pill selector -->
  <div class="difficulty-control">
    <div class="difficulty-pills">
      <form method="post" action="/new-game" hx-post="/new-game" hx-target="#game-container" hx-swap="outerHTML">
        <input type="hidden" name="difficulty" value="easy">
        <button type="submit" class="difficulty-pill easy ${state.difficulty === 'easy' ? 'active' : ''}">Easy</button>
      </form>
      
      <form method="post" action="/new-game" hx-post="/new-game" hx-target="#game-container" hx-swap="outerHTML">
        <input type="hidden" name="difficulty" value="medium">
        <button type="submit" class="difficulty-pill medium ${state.difficulty === 'medium' ? 'active' : ''}">Medium</button>
      </form>
      
      <form method="post" action="/new-game" hx-post="/new-game" hx-target="#game-container" hx-swap="outerHTML">
        <input type="hidden" name="difficulty" value="hard">
        <button type="submit" class="difficulty-pill hard ${state.difficulty === 'hard' ? 'active' : ''}">Hard</button>
      </form>
    </div>
  </div>

  ${hangmanSvg(state)}
  ${wordDisplay(state)}
  ${statusDisplay(state)}
  ${keyboard(state)}
  ${difficultySelector(state)}
</div>
`;

const hangmanSvg = (state: GameState): string => {
  const { status, wrongGuesses } = state;

  return match(status)
    .with("won", () => celebrationSvg())
    .otherwise(() => `
      <div class="hangman-display">
        <svg class="hangman-figure" viewBox="0 0 200 200" aria-hidden="true" style="background-color: transparent !important; background: none !important;" fill="none">
          <!-- Base gallows structure (always visible) -->
          <path d="M20 180h160M60 180l-20-140h120l-20 140" stroke="var(--primary-color)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none" />
          <path d="M30 40h140" stroke="var(--primary-color)" stroke-width="4" stroke-linecap="round" fill="none" />
          
          <!-- Hangman parts - visible based on wrong guesses -->
          ${wrongGuesses >= 1 ? `<path class="hangman-part visible" d="M100 40v30" fill="none" />` : ''}
          ${wrongGuesses >= 2 ? `<g class="hangman-part visible" fill="none">
            <circle cx="100" cy="70" r="15" fill="white" stroke="var(--primary-color)" stroke-width="4" />
            <path d="M92 75c0 0 5 5 16 0" stroke="red" stroke-width="2" stroke-linecap="round" transform="rotate(180 100 75)" fill="none" />
            <circle cx="93" cy="65" r="2" fill="red" />
            <circle cx="107" cy="65" r="2" fill="red" />
          </g>` : ''}
          ${wrongGuesses >= 3 ? `<path class="hangman-part visible" d="M100 85v50" fill="none" />` : ''}
          ${wrongGuesses >= 4 ? `<path class="hangman-part visible" d="M100 95c-10 5-20 15-30 20" fill="none" />` : ''}
          ${wrongGuesses >= 5 ? `<path class="hangman-part visible" d="M100 95c10 5 20 15 30 20" fill="none" />` : ''}
          ${wrongGuesses >= 6 ? `<path class="hangman-part visible" d="M100 135c-8 8-17 17-25 25" fill="none" />` : ''}
          ${wrongGuesses >= 7 ? `<path class="hangman-part visible" d="M100 135c8 8 17 17 25 25" fill="none" />` : ''}
        </svg>
      </div>
    `);
};

const celebrationSvg = (): string => `
<div class="hangman-display">
  <svg class="celebrate-figure" viewBox="0 0 200 200" aria-hidden="true" style="background-color: transparent !important; background: none !important;" fill="none">
    <!-- Background celebratory elements -->
    <g class="confetti">
      <circle cx="50" cy="50" r="3" fill="gold" />
      <circle cx="150" cy="60" r="4" fill="#FF6B6B" />
      <path d="M70 40l5 5-5 5 5-5-5-5" stroke="#4ECDC4" stroke-width="2" />
      <path d="M130 30l5 5-5 5 5-5-5-5" stroke="#FF6B6B" stroke-width="2" />
      <path d="M40 120l5 5-5 5 5-5-5-5" stroke="#FFE66D" stroke-width="2" />
      <path d="M160 140l5 5-5 5 5-5-5-5" stroke="#4ECDC4" stroke-width="2" />
    </g>
    
    <!-- Animated stick figure with happy face -->
    <g>
      <circle cx="100" cy="70" r="15" stroke="green" stroke-width="4" fill="none" />
      <path d="M92 75c0 0 5 5 16 0" stroke="green" stroke-width="2" stroke-linecap="round" />
      <circle cx="93" cy="65" r="2" fill="green" />
      <circle cx="107" cy="65" r="2" fill="green" />
    </g>
    
    <path d="M100 85v50" stroke="green" stroke-width="4" stroke-linecap="round" />
    <path d="M100 95l-30 -20" stroke="green" stroke-width="4" stroke-linecap="round" />
    <path d="M100 95l30 -20" stroke="green" stroke-width="4" stroke-linecap="round" />
    <path d="M100 135l-25 25" stroke="green" stroke-width="4" stroke-linecap="round" />
    <path d="M100 135l25 25" stroke="green" stroke-width="4" stroke-linecap="round" />
  </svg>
</div>
`;

const wordDisplay = (state: GameState): string => {
  // Use Result type for error handling and pattern matching
  const _displayLetters = unwrapOr(getDisplayWord(state), []);

  return `
  <div class="word-display" aria-live="polite">
    ${[...state.word].map(letter => `
      <span class="letter">
        ${state.guessedLetters.has(letter) ? letter : ''}
      </span>
    `).join('')}
  </div>
  `;
};

const statusDisplay = (state: GameState): string => {
  // Use pattern matching for cleaner conditional logic
  const [message, statusClass] = match(state.status)
    .with("playing", () => ["Guess the word!", ""])
    .with("won", () => [`🎉 You won! The word was ${state.word}.`, "win"])
    .with("lost", () => [`Game Over! The word was ${state.word}.`, "lose"])
    .exhaustive();

  return `
  <div class="status ${statusClass}" role="alert">
    ${message}
  </div>
  `;
};

const keyboard = (state: GameState): string => {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  // Pattern match on game status
  const isGameOver = match(state.status)
    .with("playing", () => false)
    .otherwise(() => true);

  return `
  <div class="keyboard ${isGameOver ? 'game-over' : ''}" role="group" aria-label="Keyboard">
    ${[...letters].map(letter => `
      <form style="margin:0; padding:0; display:contents;" method="post" action="/guess/${letter}" hx-post="/guess/${letter}" hx-target="#game-container" hx-swap="outerHTML">
        <button 
          type="submit"
          data-letter="${letter}"
          aria-label="${letter}"
          ${state.guessedLetters.has(letter) ? 'disabled' : ''}
          ${isGameOver ? 'disabled' : ''}
        >${letter}</button>
      </form>
    `).join('')}
    <form style="margin:0; padding:0; display:contents;" method="post" action="/new-game" hx-post="/new-game" hx-target="#game-container" hx-swap="outerHTML">
      <button 
        type="submit"
        class="restart" 
        aria-label="New Game"
      >New Game</button>
    </form>
  </div>
  `;
};

const difficultySelector = (state: GameState): string => `
<div class="difficulty-selector">
  <form method="post" action="/new-game" hx-post="/new-game" hx-target="#game-container" hx-swap="outerHTML">
    <label for="difficulty">Difficulty: </label>
    <select 
      id="difficulty" 
      name="difficulty"
      aria-label="Select difficulty level"
      hx-trigger="change"
      hx-include="this"
    >
      <option value="easy" ${state.difficulty === 'easy' ? 'selected' : ''}>Easy</option>
      <option value="medium" ${state.difficulty === 'medium' ? 'selected' : ''}>Medium</option>
      <option value="hard" ${state.difficulty === 'hard' ? 'selected' : ''}>Hard</option>
    </select>
  </form>
</div>
`;

// HANDLERS
const getOrCreateGameSession = (request: Request): Result<[string, GameState]> => {
  const cookies = request.headers.get("cookie") || "";
  const sessionCookie = cookies
    .split(";")
    .map(c => c.trim())
    .find(c => c.startsWith("hangman_session="));

  let sessionId = sessionCookie?.split("=")[1];
  let gameState: GameState | undefined;

  if (sessionId) {
    gameState = getSession(sessionId);
  }

  if (!sessionId || !gameState) {
    const gameResult = createGame();
    if (!gameResult.ok) {
      return gameResult;
    }

    gameState = gameResult.value;
    sessionId = createSession(gameState);
  }

  return ok([sessionId, gameState]);
};

const gameHandler = (request: Request): Promise<Response> => {
  const sessionResult = getOrCreateGameSession(request);

  if (!sessionResult.ok) {
    return Promise.resolve(new Response(`Error: ${sessionResult.error.message}`, { status: 500 }));
  }

  const [sessionId, gameState] = sessionResult.value;

  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Set-Cookie": `hangman_session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600`
  });

  const content = gameComponent(gameState);
  return Promise.resolve(new Response(baseTemplate(content), { headers }));
};

// Handle new game creation request
const newGameHandler = async (request: Request): Promise<Response> => {
  const sessionResult = getOrCreateGameSession(request);

  if (!sessionResult.ok) {
    return Promise.resolve(new Response(`Error: ${sessionResult.error.message}`, { status: 500 }));
  }

  const [sessionId, _] = sessionResult.value;

  try {
    // Log for debugging
    console.log("New game request received");
    
    // First check if this is JSON data from hx-vals
    let difficulty: Difficulty = "medium";
    const contentType = request.headers.get("Content-Type");
    
    if (contentType && contentType.includes("application/json")) {
      // From pill buttons using hx-vals
      const jsonData = await request.json();
      if (jsonData.difficulty && 
          (jsonData.difficulty === "easy" || 
           jsonData.difficulty === "medium" || 
           jsonData.difficulty === "hard")) {
        difficulty = jsonData.difficulty as Difficulty;
      }
    } else {
      // From traditional form data
      const formData = await request.formData();
      const difficultyValue = formData.get("difficulty");
      if (difficultyValue === "easy" || 
          difficultyValue === "medium" || 
          difficultyValue === "hard") {
        difficulty = difficultyValue as Difficulty;
      }
    }

    console.log(`Creating new game with difficulty: ${difficulty}`);
    
    const gameResult = createGame(difficulty);
    if (!gameResult.ok) {
      console.error(`Error creating game: ${gameResult.error.message}`);
      return Promise.resolve(new Response(`Error: ${gameResult.error.message}`, { status: 500 }));
    }

    setSession(sessionId, gameResult.value);

    const headers = new Headers({
      "Content-Type": "text/html; charset=utf-8",
      "Set-Cookie": `hangman_session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600`
    });

    // Make sure we're just returning the game component HTML, not a full page
    const responseContent = gameComponent(gameResult.value);
    console.log("New game response content length:", responseContent.length);
    
    return Promise.resolve(new Response(responseContent, { headers }));
  } catch (error) {
    console.error("Error in newGameHandler:", error);
    return Promise.resolve(new Response(`Error: ${error instanceof Error ? error.message : String(error)}`, { status: 500 }));
  }
};

// Handle letter guess request
const guessHandler = (request: Request, params?: Record<string, string>): Promise<Response> => {
  const letter = params?.letter?.toUpperCase() || "";
  if (!/^[A-Z]$/.test(letter)) {
    return Promise.resolve(new Response("Invalid letter", { status: 400 }));
  }

  const sessionResult = getOrCreateGameSession(request);

  if (!sessionResult.ok) {
    return Promise.resolve(new Response(`Error: ${sessionResult.error.message}`, { status: 500 }));
  }

  const [sessionId, gameState] = sessionResult.value;

  // Log for debugging
  console.log(`Guess handler processing letter: ${letter} for session: ${sessionId}`);
  console.log(`Current game state: Word: ${gameState.word}, Guessed: ${Array.from(gameState.guessedLetters).join(',')}, Status: ${gameState.status}`);
  
  // Process the guess and update the session
  const updatedStateResult = processGuess(gameState, letter);

  if (!updatedStateResult.ok) {
    console.error(`Error processing guess: ${updatedStateResult.error.message}`);
    return Promise.resolve(new Response(`Error: ${updatedStateResult.error.message}`, { status: 500 }));
  }

  const updatedState = updatedStateResult.value;
  console.log(`Updated game state: Word: ${updatedState.word}, Guessed: ${Array.from(updatedState.guessedLetters).join(',')}, Status: ${updatedState.status}`);
  
  setSession(sessionId, updatedState);

  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Set-Cookie": `hangman_session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600`
  });

  // Make sure we're just returning the game component HTML, not a full page
  const responseContent = gameComponent(updatedState);
  console.log("Response content length:", responseContent.length);
  
  return Promise.resolve(new Response(responseContent, { headers }));
};

// Handle static file requests
const staticFileHandler = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const filePath = url.pathname.replace(/^\/static\//, "");

  // Log for debugging
  console.log(`Static file request for: ${filePath}`);

  // If this is styles.css, serve our embedded styles
  if (filePath === "styles.css") {
    console.log("Serving embedded CSS with correct MIME type");
    const cssContent = getCSS();
    return new Response(cssContent, {
      headers: { 
        "Content-Type": "text/css",
        "Cache-Control": "public, max-age=604800"
      }
    });
  }

  console.log(`File not found: ${filePath}`);
  return new Response(`Not found: ${filePath}`, { status: 404 });
};

// Function to get the CSS content
function getCSS() {
  return `:root {
  --primary-color: #2c3e50;
  --secondary-color: #3498db;
  --success-color: #2ecc71;
  --danger-color: #e74c3c;
  --text-color: #34495e;
  --transition-speed: 300ms;
  --transition-easing: cubic-bezier(0.25, 0.1, 0.25, 1);
  --hover-scale: 1.03;
  
  /* Responsive sizing variables */
  --base-padding: clamp(0.5rem, 3vw, 2rem);
  --font-size-h1: clamp(1.75rem, 5vw, 2.5rem);
  --font-size-word: clamp(1.25rem, 4vw, 2.5rem);
  --font-size-btn: clamp(0.9rem, 2.5vw, 1.1rem);
  --letter-spacing: clamp(0.2rem, 1vw, 0.5rem);
  --button-size: clamp(32px, 8vw, 40px);
  --svg-width: clamp(220px, 70vw, 300px);
}

body {
  margin: 0;
  padding: var(--base-padding);
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
}

header {
  text-align: center;
  margin-bottom: 5px;
  position: relative;
  z-index: 0;
  transform: translateY(0.1rem);
  pointer-events: none;
}

h1 {
  color: rgba(44, 62, 80, 0.8);
  margin: 0;
  font-size: calc(var(--font-size-h1) * 1.5);
  line-height: 1.2;
  font-weight: 800;
  letter-spacing: -0.05em;
  text-transform: uppercase;
  text-shadow: 
    0 5px 10px rgba(0, 0, 0, 0.15),
    0 2px 4px rgba(0, 0, 0, 0.2),
    2px 2px 0px #4a6fa5,
    -2px -2px 0px #c3cfe2;
  transform: perspective(500px) rotateX(10deg);
  transition: all 0.3s ease;
  position: relative;
  display: inline-block;
}

.game-container {
  width: 100%;
  max-width: 800px;
  padding: var(--base-padding);
  background: #f8f9fa;
  border-radius: 1rem;
  box-shadow: 
    0 10px 20px rgba(0, 0, 0, 0.1),
    0 0 0 1px rgba(0, 0, 0, 0.05);
  transition: transform var(--transition-speed) var(--transition-easing);
  position: relative;
  z-index: 2;
  box-sizing: border-box;
  margin-top: -1rem;
  backdrop-filter: blur(5px);
}

.hangman-display {
  position: relative;
  width: var(--svg-width);
  margin: 0 auto;
  transition: transform var(--transition-speed) var(--transition-easing);
  background: transparent !important;
  background-color: transparent !important;
}

svg {
  width: 100%;
  height: auto;
  transform-origin: center;
  transition: all var(--transition-speed) var(--transition-easing);
  background: transparent !important;
}

.hangman-figure, .celebrate-figure {
  background: transparent !important;
}

.hangman-part {
  stroke: var(--primary-color);
  stroke-width: 4;
  stroke-linecap: round;
  fill: transparent !important;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.hangman-part.visible {
  opacity: 1;
}

/* Word display */
.word-display {
  display: flex;
  justify-content: center;
  gap: clamp(0.5rem, 2vw, 1rem);
  margin: clamp(1rem, 3vw, 2rem) 0;
  font-size: var(--font-size-word);
  letter-spacing: var(--letter-spacing);
  color: var(--text-color);
  flex-wrap: wrap;
}

.letter {
  border-bottom: 4px solid var(--secondary-color);
  min-width: 1em;
  text-align: center;
  text-transform: uppercase;
}

/* Status display */
.status {
  text-align: center;
  margin: 1rem 0;
  font-size: 1.2rem;
  color: var(--text-color);
  height: 1.5em;
  display: flex;
  align-items: center;
  justify-content: center;
}

.status.win {
  color: var(--success-color);
  font-weight: bold;
}

.status.lose {
  color: var(--danger-color);
  font-weight: bold;
}

/* Keyboard */
.keyboard {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(var(--button-size), 1fr));
  gap: clamp(0.25rem, 1vw, 0.5rem);
  margin-top: clamp(1rem, 3vw, 2rem);
}

.keyboard.game-over {
  opacity: 0.7;
}

button {
  padding: clamp(0.4rem, 2vw, 0.8rem);
  border: none;
  border-radius: 0.5rem;
  background: var(--secondary-color);
  color: white;
  font-size: var(--font-size-btn);
  cursor: pointer;
  transition: all var(--transition-speed) var(--transition-easing);
  min-height: var(--button-size);
  touch-action: manipulation;
}

button:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
  opacity: 0.7;
}

button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.15);
}

button:active:not(:disabled) {
  transform: translateY(1px);
}

.restart {
  background: var(--success-color);
  grid-column: span 3;
}

/* Difficulty selector styles - both traditional and pill-based */
.difficulty-selector {
  text-align: center;
  margin-top: 1.5rem;
  display: none; /* Hide the original selector */
}

.difficulty-control {
  margin-bottom: clamp(1rem, 3vw, 1.5rem);
  text-align: center;
}

.difficulty-pills {
  display: flex;
  justify-content: center;
  gap: clamp(0.3rem, 1vw, 0.5rem);
  margin-bottom: clamp(1rem, 3vw, 1.5rem);
}

.difficulty-pills form {
  margin: 0;
  padding: 0;
  display: contents;
}

.difficulty-pill {
  flex: 0 1 auto;
  background: rgba(52, 152, 219, 0.1);
  color: var(--secondary-color);
  border: 1px solid var(--secondary-color);
  border-radius: 2rem;
  padding: clamp(0.3rem, 1.5vw, 0.5rem) clamp(0.8rem, 3vw, 1.2rem);
  font-size: clamp(0.85rem, 2.5vw, 0.95rem);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 60px;
}

.difficulty-pill:hover {
  background: rgba(52, 152, 219, 0.2);
  transform: translateY(-2px);
}

.difficulty-pill.active {
  background: var(--secondary-color);
  color: white;
  box-shadow: 0 2px 8px rgba(52, 152, 219, 0.4);
}

.difficulty-pill.easy.active {
  background: #27ae60;
  border-color: #27ae60;
  box-shadow: 0 2px 8px rgba(39, 174, 96, 0.4);
}

.difficulty-pill.medium.active {
  background: #f39c12;
  border-color: #f39c12;
  box-shadow: 0 2px 8px rgba(243, 156, 18, 0.4);
}

.difficulty-pill.hard.active {
  background: #e74c3c;
  border-color: #e74c3c;
  box-shadow: 0 2px 8px rgba(231, 76, 60, 0.4);
}

select {
  padding: 0.5rem;
  border-radius: 0.25rem;
  border: 1px solid #ccc;
  font-family: inherit;
  background-color: white;
}

footer {
  margin-top: 3rem;
  color: #666;
  font-size: 0.9rem;
  text-align: center;
}

@media (max-width: 600px) {
  header {
    transform: translateY(1.5rem);
  }
  
  h1 {
    font-size: calc(var(--font-size-h1) * 1.2);
    transform: perspective(500px) rotateX(8deg);
  }
  
  .game-container {
    margin-top: -0.5rem;
  }
  
  footer {
    margin-bottom: clamp(1rem, 3vw, 2rem);
  }

  .letter {
    border-bottom-width: 3px;
  }

  .difficulty-selector {
    margin-top: clamp(1rem, 3vw, 1.5rem);
  }
  
  /* Add extra touch area for better mobile experience */
  button {
    position: relative;
  }
  
  button::after {
    content: '';
    position: absolute;
    top: -8px;
    left: -8px;
    right: -8px;
    bottom: -8px;
    z-index: -1;
  }
}`;
}

// SETUP SIGNAL HANDLERS
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

// MAIN SERVER FUNCTION
const runServer = function*() {
  // Log environment info for debugging
  console.log("Current working directory:", Deno.cwd());
  try {
    const files = [...Deno.readDirSync("./static")];
    console.log("Static files available:", files.map(f => f.name));
  } catch (e) {
    console.error("Error reading static directory:", e);
  }
  
  const router = createRouter([
    { path: "/", handler: gameHandler },
    { path: "/new-game", handler: newGameHandler },
    { path: "/guess/:letter", handler: guessHandler },
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
    console.log("Hangman server running at http://localhost:8000/");
    const server = Deno.serve({ port: 8000, signal }, async (req: Request) => {
      const url = new URL(req.url);
      const path = url.pathname;

      // Log every request for debugging
      console.log(`Request: ${req.method} ${path}`);
      
      try {
        const response = await router(req, path);
        
        // Check that htmx requests get proper responses
        if (req.headers.get("HX-Request")) {
          console.log("HTMX request detected");
          response.headers.set("Content-Type", "text/html; charset=utf-8");
        }
        
        return response;
      } catch (error) {
        console.error("Server error:", error);
        return new Response("Server error", { status: 500 });
      }
    });
    
    // Create a task to monitor the abort signal
    yield* effection.spawn(function*() {
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
      Deno.removeSignalListener("SIGINT", () => {});
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
effection.main(runServer);