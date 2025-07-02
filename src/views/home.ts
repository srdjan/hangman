import { GameState } from "../types.ts";
import { match } from "../utils/pattern.ts";
import { categories } from "../data/wordLists.ts";

export const homePage = (content: string): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Secure Hangman Game</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/htmx.org@2.0.4"></script>
  <link rel="stylesheet" href="/static/styles.css">
  <script src="/static/keyboard.js" defer></script>

  <!-- Accessibility features -->
  <div id="screen-reader-announcer" aria-live="assertive" aria-atomic="true" class="sr-only"></div>
  <style>
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border-width: 0;
    }

    /* Animation classes */
    .correct-guess {
      animation: pulse-green 0.5s ease-in-out;
    }

    .incorrect-guess {
      animation: shake 0.5s ease-in-out;
    }

    @keyframes pulse-green {
      0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(46, 204, 113, 0.7); }
      50% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(46, 204, 113, 0); }
      100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(46, 204, 113, 0); }
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
      20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
  </style>
</head>
<body>
  <header></header>

  ${content}

  <footer>
    <p>Cooked with ❤️ by <a href="https://srdjan.github.io" target="_blank" rel="noopener noreferrer">⊣˚∆˚⊢</a></p>
  </footer>
</body>
</html>
`;

export const gameComponent = (state: GameState): string => `
<div class="game-container" id="game-container">
  <!-- Top navigation bar -->
  <div class="game-header">
    <div class="game-title">
      <h2>Hangman</h2>
    </div>

    <div class="game-nav">
      <!-- Dashboard toggle button -->
      <button
        class="dashboard-toggle"
        aria-label="Toggle statistics dashboard"
        onclick="document.getElementById('game-stats').classList.toggle('visible');"
      >
        <span class="dashboard-icon">📊</span>
      </button>
    </div>
  </div>

  <!-- Game status -->
  ${statusDisplay(state)}

  <!-- Main game area -->
  <div class="game-main">
    <!-- Game statistics (hidden by default) -->
    <div id="game-stats" class="game-stats">
      ${gameStatsContent(state)}
    </div>

    <!-- Hangman figure -->
    ${hangmanSvg(state)}

    <!-- Word display -->
    ${wordDisplay(state)}

    <!-- Hint button -->
    ${hintButton(state)}
  </div>

  <!-- Keyboard -->
  ${keyboard(state)}
</div>
`;

// SVG Components for hangman visualization
export const hangmanSvg = (state: GameState): string => {
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

export const celebrationSvg = (): string => `
<div class="hangman-display">
  <svg class="celebrate-figure" viewBox="0 0 200 200" aria-hidden="true" style="background-color: transparent;" fill="none">
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
  return `
  <div class="word-display" aria-live="polite">
    ${[...state.word].map(letter => `
      <span class="letter">${state.guessedLetters.has(letter) ? letter : '<span style="visibility:hidden">X</span>'}</span>
    `).join('')}
  </div>
  `;
};

export const statusDisplay = (state: GameState): string => {
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

  const isGameOver = match(state.status)
    .with("playing", () => false)
    .otherwise(() => true);

  return `
  <div class="keyboard ${isGameOver ? 'game-over' : ''}" role="group" aria-label="Keyboard">
    ${[...letters].map(letter => {
    const isGuessed = state.guessedLetters.has(letter);
    const isCorrect = state.word.includes(letter) && isGuessed;
    const isIncorrect = !state.word.includes(letter) && isGuessed;
    let ariaLabel = letter;

    if (isCorrect) {
      ariaLabel = `${letter}, correct guess`;
    } else if (isIncorrect) {
      ariaLabel = `${letter}, incorrect guess`;
    }

    return `
      <button
        data-letter="${letter}"
        aria-label="${ariaLabel}"
        aria-pressed="${isGuessed ? 'true' : 'false'}"
        ${isGuessed ? 'disabled' : ''}
        ${isGameOver ? 'disabled' : ''}
        class="${isCorrect ? 'correct' : ''} ${isIncorrect ? 'incorrect' : ''}"
        hx-post="/guess/${letter}"
        hx-target="#game-container"
        hx-swap="outerHTML"
      >${letter}</button>
    `}).join('')}
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
  <input type="hidden" name="category" value="${state.category}">
  <select
    id="difficulty"
    name="difficulty"
    aria-label="Select difficulty level"
    hx-get="/new-game"
    hx-target="#game-container"
    hx-swap="outerHTML"
    hx-trigger="change"
    hx-include="[name='difficulty'],[name='category']"
  >
    <option value="easy" ${state.difficulty === 'easy' ? 'selected' : ''}>Easy</option>
    <option value="medium" ${state.difficulty === 'medium' ? 'selected' : ''}>Medium</option>
    <option value="hard" ${state.difficulty === 'hard' ? 'selected' : ''}>Hard</option>
  </select>
</div>
`;

/**
 * Display game statistics content
 */
export const gameStatsContent = (state: GameState): string => {
  const { statistics } = state;
  const gameTime = state.endTime ? Math.round((state.endTime - state.startTime) / 1000) : 0;

  return `
    <h3>Game Statistics</h3>
    <div class="stats-row">
      <div class="stat-box">
        <div class="stat-value">${statistics.gamesPlayed}</div>
        <div class="stat-label">Games</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${statistics.gamesWon}</div>
        <div class="stat-label">Wins</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${Math.round((statistics.gamesWon / (statistics.gamesPlayed || 1)) * 100)}%</div>
        <div class="stat-label">Win Rate</div>
      </div>
    </div>
    <div class="stats-row">
      <div class="stat-box">
        <div class="stat-value">${statistics.currentStreak}</div>
        <div class="stat-label">Streak</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${statistics.bestStreak}</div>
        <div class="stat-label">Best</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${state.status !== "playing" ? gameTime : ""}</div>
        <div class="stat-label">${state.status !== "playing" ? "Seconds" : ""}</div>
      </div>
    </div>
  `;
};

/**
 * Display game statistics (for backward compatibility)
 */
export const gameStats = (state: GameState): string => {
  return `
  <div class="game-stats" aria-label="Game Statistics">
    ${gameStatsContent(state)}
  </div>
  `;
};

/**
 * Hint button component
 */
export const hintButton = (state: GameState): string => {
  const isDisabled = state.status !== "playing" || state.hintsUsed >= state.hintsAllowed;
  const hintsLeft = state.hintsAllowed - state.hintsUsed;

  return `
  <div class="hint-container">
    <button
      class="hint-button ${isDisabled ? 'disabled' : ''}"
      ${isDisabled ? 'disabled' : ''}
      hx-post="/hint"
      hx-target="#game-container"
      hx-swap="outerHTML"
      aria-label="Get a hint. ${hintsLeft} hint${hintsLeft !== 1 ? 's' : ''} remaining."
    >
      <span class="hint-icon">💡</span>
      <span class="hint-text">Hint (${hintsLeft} left)</span>
    </button>
  </div>
  `;
};