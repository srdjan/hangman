import { GameState, TwoPlayerGameState, PlayerGameState, Player } from "../types.ts";
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
  <!-- Accessibility features -->
  <div id="screen-reader-announcer" aria-live="assertive" aria-atomic="true" class="sr-only"></div>

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
      <!-- Difficulty selector -->
      <div class="difficulty-control">
        <div class="difficulty-pills">
          <form hx-post="/new-game" hx-target="#game-container" hx-swap="outerHTML">
            <input type="hidden" name="difficulty" value="easy">
            <input type="hidden" name="category" value="${state.category}">
            <button type="submit" class="difficulty-pill easy ${state.difficulty === 'easy' ? 'active' : ''}">Easy</button>
          </form>

          <form hx-post="/new-game" hx-target="#game-container" hx-swap="outerHTML">
            <input type="hidden" name="difficulty" value="medium">
            <input type="hidden" name="category" value="${state.category}">
            <button type="submit" class="difficulty-pill medium ${state.difficulty === 'medium' ? 'active' : ''}">Medium</button>
          </form>

          <form hx-post="/new-game" hx-target="#game-container" hx-swap="outerHTML">
            <input type="hidden" name="difficulty" value="hard">
            <input type="hidden" name="category" value="${state.category}">
            <button type="submit" class="difficulty-pill hard ${state.difficulty === 'hard' ? 'active' : ''}">Hard</button>
          </form>
        </div>
      </div>

      <!-- Category dropdown -->
      <div class="category-dropdown">
        <input type="hidden" name="difficulty" value="${state.difficulty}">
        <select
          id="category-select"
          aria-label="Select word category"
          hx-get="/new-game"
          hx-target="#game-container"
          hx-swap="outerHTML"
          hx-trigger="change"
          name="category"
          hx-include="[name='category'],[name='difficulty']"
        >
          ${categories.map(category => `
            <option value="${category.name}" ${state.category === category.name ? 'selected' : ''}>${category.name}</option>
          `).join('')}
        </select>
      </div>

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
        hx-post="/guess/${letter}?category=${encodeURIComponent(state.category)}&difficulty=${state.difficulty}"
        hx-target="#game-container"
        hx-swap="outerHTML"
      >${letter}</button>
    `}).join('')}
    <button
      class="restart"
      aria-label="New Game"
      hx-post="/new-game?category=${encodeURIComponent(state.category)}&difficulty=${state.difficulty}"
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
      hx-post="/hint?category=${encodeURIComponent(state.category)}&difficulty=${state.difficulty}"
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

/**
 * Two-player game component - main container
 */
export const twoPlayerGameComponent = (state: TwoPlayerGameState): string => `
<div class="two-player-game-container" id="game-container">
  <!-- Game header with scores and turn indicator -->
  <div class="two-player-header">
    <div class="game-title">
      <h2>Hangman - Two Player</h2>
    </div>
    <div class="turn-indicator">
      <span class="current-turn ${state.currentTurn === 'player1' ? 'active' : ''}">
        ${state.player1.playerName}'s Turn
      </span>
      <span class="turn-divider">|</span>
      <span class="current-turn ${state.currentTurn === 'player2' ? 'active' : ''}">
        ${state.player2.playerName}'s Turn
      </span>
    </div>
    <div class="score-display">
      <span class="score">${state.player1.playerName}: ${state.scores.player1}</span>
      <span class="score-divider">-</span>
      <span class="score">${state.player2.playerName}: ${state.scores.player2}</span>
    </div>
  </div>

  <!-- Split screen game area -->
  <div class="two-player-main">
    <div class="player-panel player1-panel">
      ${playerGamePanel(state.player1, state.currentTurn === 'player1')}
    </div>

    <div class="game-divider"></div>

    <div class="player-panel player2-panel">
      ${playerGamePanel(state.player2, state.currentTurn === 'player2')}
    </div>
  </div>

  <!-- Shared input area -->
  ${sharedInputArea(state)}

  <!-- Game over display -->
  ${twoPlayerGameOverDisplay(state)}
</div>
`;

/**
 * Individual player game panel
 */
export const playerGamePanel = (playerState: PlayerGameState, isCurrentTurn: boolean): string => `
<div class="player-game-area ${isCurrentTurn ? 'current-player' : ''}">
  <div class="player-header">
    <h3>${playerState.playerName}</h3>
    <div class="player-status">
      ${match(playerState.status)
    .with("playing", () => isCurrentTurn ? "🎯 Your Turn" : "⏳ Waiting")
    .with("won", () => "🎉 Won!")
    .with("lost", () => "💀 Lost")
    .exhaustive()}
    </div>
  </div>

  <!-- Player's hangman display -->
  <div class="player-hangman">
    ${playerHangmanSvg(playerState)}
  </div>

  <!-- Player's word display -->
  <div class="player-word">
    ${playerWordDisplay(playerState)}
  </div>

  <!-- Player's wrong guesses -->
  <div class="player-wrong-guesses">
    <span class="wrong-label">Wrong: </span>
    <span class="wrong-count">${playerState.wrongGuesses}/${playerState.maxWrong}</span>
  </div>
</div>
`;

/**
 * Player-specific hangman SVG
 */
export const playerHangmanSvg = (playerState: PlayerGameState): string => {
  const { status, wrongGuesses } = playerState;

  return match(status)
    .with("won", () => `
      <div class="hangman-display">
        <svg class="celebrate-figure" viewBox="0 0 200 200" aria-hidden="true" fill="none">
          <text x="100" y="100" text-anchor="middle" font-size="60" fill="var(--success-color)">🎉</text>
        </svg>
      </div>
    `)
    .otherwise(() => `
      <div class="hangman-display">
        <svg class="hangman-figure" viewBox="0 0 200 200" aria-hidden="true" fill="none">
          <!-- Base gallows structure -->
          <path d="M20 180h160M60 180l-20-140h120l-20 140" stroke="var(--primary-color)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none" />
          <path d="M30 40h140" stroke="var(--primary-color)" stroke-width="3" stroke-linecap="round" fill="none" />

          <!-- Hangman parts based on wrong guesses -->
          ${wrongGuesses >= 1 ? '<circle cx="100" cy="60" r="15" stroke="var(--primary-color)" stroke-width="3" fill="none" />' : ''}
          ${wrongGuesses >= 2 ? '<path d="M100 75v50" stroke="var(--primary-color)" stroke-width="3" stroke-linecap="round" />' : ''}
          ${wrongGuesses >= 3 ? '<path d="M100 90l-20 20" stroke="var(--primary-color)" stroke-width="3" stroke-linecap="round" />' : ''}
          ${wrongGuesses >= 4 ? '<path d="M100 90l20 20" stroke="var(--primary-color)" stroke-width="3" stroke-linecap="round" />' : ''}
          ${wrongGuesses >= 5 ? '<path d="M100 125l-20 25" stroke="var(--primary-color)" stroke-width="3" stroke-linecap="round" />' : ''}
          ${wrongGuesses >= 6 ? '<path d="M100 125l20 25" stroke="var(--primary-color)" stroke-width="3" stroke-linecap="round" />' : ''}
          ${wrongGuesses >= 7 ? '<path d="M85 55l10 10M115 55l-10 10" stroke="var(--danger-color)" stroke-width="3" stroke-linecap="round" />' : ''}
        </svg>
      </div>
    `);
};

/**
 * Player-specific word display
 */
export const playerWordDisplay = (playerState: PlayerGameState): string => {
  return `
  <div class="word-display" aria-live="polite">
    ${[...playerState.word].map(letter => `
      <span class="letter">${playerState.guessedLetters.has(letter) ? letter : '<span style="visibility:hidden">X</span>'}</span>
    `).join('')}
  </div>
  `;
};

/**
 * Shared input area for two-player game
 */
export const sharedInputArea = (state: TwoPlayerGameState): string => {
  const isGameOver = state.gameStatus !== "playing";
  const currentPlayer = state.currentTurn === "player1" ? state.player1 : state.player2;

  // Get all guessed letters from both players
  const allGuessedLetters = new Set([
    ...state.player1.guessedLetters,
    ...state.player2.guessedLetters
  ]);

  return `
  <div class="shared-input-area">
    <div class="input-header">
      <h4>${isGameOver ? "Game Over" : `${currentPlayer.playerName}'s Turn`}</h4>
    </div>

    <div class="keyboard ${isGameOver ? 'game-over' : ''}">
      ${"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('').map(letter => {
    const isGuessed = allGuessedLetters.has(letter);
    const isCorreectP1 = state.player1.word.includes(letter) && state.player1.guessedLetters.has(letter);
    const isCorreectP2 = state.player2.word.includes(letter) && state.player2.guessedLetters.has(letter);
    const isCorrect = isCorreectP1 || isCorreectP2;
    const isIncorrect = isGuessed && !isCorrect;

    return `
          <button
            data-letter="${letter}"
            aria-label="Guess letter ${letter}"
            aria-pressed="${isGuessed ? 'true' : 'false'}"
            ${isGuessed ? 'disabled' : ''}
            ${isGameOver ? 'disabled' : ''}
            class="${isCorrect ? 'correct' : ''} ${isIncorrect ? 'incorrect' : ''}"
            hx-post="/two-player/guess/${letter}?category=${encodeURIComponent(currentPlayer.category)}&difficulty=${currentPlayer.difficulty}"
            hx-target="#game-container"
            hx-swap="outerHTML"
          >${letter}</button>
        `;
  }).join('')}

      <button
        class="restart"
        aria-label="New Two-Player Game"
        hx-post="/two-player/new-game?category=${encodeURIComponent(currentPlayer.category)}&difficulty=${currentPlayer.difficulty}"
        hx-target="#game-container"
        hx-swap="outerHTML"
      >New Game</button>
    </div>
  </div>
  `;
};

/**
 * Two-player game over display
 */
export const twoPlayerGameOverDisplay = (state: TwoPlayerGameState): string => {
  if (state.gameStatus === "playing") {
    return "";
  }

  const [message, statusClass] = match(state.gameStatus)
    .with("player1Won", () => [`🎉 ${state.player1.playerName} wins! Word: ${state.player1.word}`, "win"])
    .with("player2Won", () => [`🎉 ${state.player2.playerName} wins! Word: ${state.player2.word}`, "win"])
    .with("bothLost", () => [`💀 Both players lost! Words: ${state.player1.word}, ${state.player2.word}`, "lose"])
    .with("gameOver", () => ["Game Over!", ""])
    .exhaustive();

  return `
  <div class="two-player-game-over ${statusClass}" role="alert">
    <div class="game-over-message">${message}</div>
    <div class="final-scores">
      Final Score: ${state.player1.playerName} ${state.scores.player1} - ${state.scores.player2} ${state.player2.playerName}
    </div>
  </div>
  `;
};

/**
 * Game mode selection component
 */
export const gameModeSelector = (): string => `
<div class="game-mode-selector" id="game-container">
  <div class="mode-header">
    <h2>Choose Game Mode</h2>
    <p>Select how you want to play Hangman</p>
  </div>

  <div class="mode-options">
    <div class="mode-card">
      <div class="mode-icon">🎯</div>
      <h3>Single Player</h3>
      <p>Play against the computer and try to guess the word before the hangman is complete.</p>
      <button
        class="mode-button single-player"
        hx-get="/?mode=single"
        hx-target="#game-container"
        hx-swap="outerHTML"
      >
        Start Single Player
      </button>
    </div>

    <div class="mode-card">
      <div class="mode-icon">👥</div>
      <h3>Two Player</h3>
      <p>Compete against a friend! Take turns guessing letters and see who can complete their word first.</p>
      <button
        class="mode-button two-player"
        hx-get="/two-player"
        hx-target="#game-container"
        hx-swap="outerHTML"
      >
        Start Two Player
      </button>
    </div>
  </div>

  <div class="mode-footer">
    <p>Both modes support different difficulty levels and word categories!</p>
  </div>
</div>
`;