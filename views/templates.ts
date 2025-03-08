import { GameState } from "../types.ts";
import { getDisplayWord } from "../state/game.ts";
import { match } from "../utils/pattern.ts";
import { unwrapOr } from "../utils/result.ts";

export const baseTemplate = (content: string): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Secure Hangman Game</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/htmx.org@1.9.6"></script>
  <link rel="stylesheet" href="/static/styles.css">
</head>
<body>
  <header>
    <h1>Secure Hangman</h1>
  </header>
  
  ${content}
  
  <footer>
    <p>Made with Deno + HTMX</p>
  </footer>
</body>
</html>
`;

export const gameComponent = (state: GameState): string => `
<div class="game-container" id="game-container">
  <!-- Difficulty pill selector -->
  <div class="difficulty-control">
    <div class="difficulty-pills">
      <form hx-post="/new-game" hx-target="#game-container" hx-swap="outerHTML">
        <input type="hidden" name="difficulty" value="easy">
        <button type="submit" class="difficulty-pill easy ${state.difficulty === 'easy' ? 'active' : ''}">Easy</button>
      </form>
      
      <form hx-post="/new-game" hx-target="#game-container" hx-swap="outerHTML">
        <input type="hidden" name="difficulty" value="medium">
        <button type="submit" class="difficulty-pill medium ${state.difficulty === 'medium' ? 'active' : ''}">Medium</button>
      </form>
      
      <form hx-post="/new-game" hx-target="#game-container" hx-swap="outerHTML">
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

// SVG Components for hangman visualization
export const hangmanSvg = (state: GameState): string => {
  const { status, wrongGuesses } = state;

  return match(status)
    .with("won", () => celebrationSvg())
    .otherwise(() => `
      <div class="hangman-display">
        <svg class="hangman-figure" viewBox="0 0 200 200" aria-hidden="true">
          <!-- Base gallows structure (always visible) -->
          <path d="M20 180h160M60 180l-20-140h120l-20 140" stroke="var(--primary-color)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M30 40h140" stroke="var(--primary-color)" stroke-width="4" stroke-linecap="round" />
          
          <!-- Hangman parts - visible based on wrong guesses -->
          ${wrongGuesses >= 1 ? `<path class="hangman-part visible" d="M100 40v30" />` : ''}
          ${wrongGuesses >= 2 ? `<g class="hangman-part visible">
            <circle cx="100" cy="70" r="15" />
            <path d="M92 75c0 0 5 5 16 0" stroke="red" stroke-width="2" stroke-linecap="round" transform="rotate(180 100 75)" />
            <circle cx="93" cy="65" r="2" fill="red" />
            <circle cx="107" cy="65" r="2" fill="red" />
          </g>` : ''}
          ${wrongGuesses >= 3 ? `<path class="hangman-part visible" d="M100 85v50" />` : ''}
          ${wrongGuesses >= 4 ? `<path class="hangman-part visible" d="M100 95c-10 5-20 15-30 20" />` : ''}
          ${wrongGuesses >= 5 ? `<path class="hangman-part visible" d="M100 95c10 5 20 15 30 20" />` : ''}
          ${wrongGuesses >= 6 ? `<path class="hangman-part visible" d="M100 135c-8 8-17 17-25 25" />` : ''}
          ${wrongGuesses >= 7 ? `<path class="hangman-part visible" d="M100 135c8 8 17 17 25 25" />` : ''}
        </svg>
      </div>
    `);
};

export const celebrationSvg = (): string => `
<div class="hangman-display">
  <svg class="celebrate-figure" viewBox="0 0 200 200" aria-hidden="true">
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

export const wordDisplay = (state: GameState): string => {
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

export const statusDisplay = (state: GameState): string => {
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

export const keyboard = (state: GameState): string => {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  // Pattern match on game status
  const isGameOver = match(state.status)
    .with("playing", () => false)
    .otherwise(() => true);

  return `
  <div class="keyboard ${isGameOver ? 'game-over' : ''}" role="group" aria-label="Keyboard">
    ${[...letters].map(letter => `
      <button 
        data-letter="${letter}"
        aria-label="${letter}"
        ${state.guessedLetters.has(letter) ? 'disabled' : ''}
        ${isGameOver ? 'disabled' : ''}
        hx-post="/guess/${letter}"
        hx-target="#game-container"
        hx-swap="outerHTML"
      >${letter}</button>
    `).join('')}
    <button 
      class="restart" 
      aria-label="New Game"
      hx-post="/new-game"
      hx-target="#game-container"
      hx-swap="outerHTML"
    >New Game</button>
  </div>
  `;
};

export const difficultySelector = (state: GameState): string => `
<div class="difficulty-selector">
  <label for="difficulty">Difficulty: </label>
  <select 
    id="difficulty" 
    aria-label="Select difficulty level"
    hx-post="/new-game"
    hx-target="#game-container"
    hx-swap="outerHTML"
    hx-include="this"
  >
    <option value="easy" ${state.difficulty === 'easy' ? 'selected' : ''}>Easy</option>
    <option value="medium" ${state.difficulty === 'medium' ? 'selected' : ''}>Medium</option>
    <option value="hard" ${state.difficulty === 'hard' ? 'selected' : ''}>Hard</option>
  </select>
</div>
`;