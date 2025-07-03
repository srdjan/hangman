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

    /* Welcome notification styles */
    .welcome-notification {
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #4CAF50, #45a049);
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      max-width: 300px;
      animation: slideInRight 0.5s ease-out;
      font-weight: 500;
    }

    .welcome-notification .close-btn {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      float: right;
      font-size: 18px;
      line-height: 1;
      margin-left: 12px;
      opacity: 0.8;
      padding: 0;
    }

    .welcome-notification .close-btn:hover {
      opacity: 1;
    }

    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes slideOutRight {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }

    .welcome-notification.fade-out {
      animation: slideOutRight 0.3s ease-in forwards;
    }

    /* Win sequence styling */
    .win-sequence {
      display: inline-block;
      background: linear-gradient(135deg, #FFD700, #FFA500);
      color: #333;
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 1.1em;
      margin-top: 10px;
      box-shadow: 0 2px 8px rgba(255, 215, 0, 0.3);
      animation: winSequencePulse 2s ease-in-out infinite;
    }

    @keyframes winSequencePulse {
      0%, 100% { 
        transform: scale(1);
        box-shadow: 0 2px 8px rgba(255, 215, 0, 0.3);
      }
      50% { 
        transform: scale(1.05);
        box-shadow: 0 4px 16px rgba(255, 215, 0, 0.5);
      }
    }

    .status.win {
      text-align: center;
    }

    /* Achievement section styling */
    .recent-win-info {
      margin-top: 20px;
      padding: 15px;
      background: linear-gradient(135deg, #f8f9fa, #e9ecef);
      border-radius: 10px;
      border-left: 4px solid #FFD700;
    }

    .recent-win-info h4 {
      margin: 0 0 10px 0;
      color: #495057;
      font-size: 1.1em;
    }

    .achievement-badge {
      background: linear-gradient(135deg, #FFD700, #FFA500);
      color: #333;
      padding: 12px 16px;
      border-radius: 8px;
      font-weight: 600;
      text-align: center;
      box-shadow: 0 2px 8px rgba(255, 215, 0, 0.2);
    }

    .leaderboard-note {
      margin-top: 15px;
      text-align: center;
      color: #6c757d;
      font-style: italic;
    }
  </style>
</head>
<body>
  <header></header>

  ${content}

  <footer>
    <p>Cooked with ❤️ by <a href="https://srdjan.github.io" target="_blank" rel="noopener noreferrer">⊣˚∆˚⊢</a></p>
  </footer>

  <script>
    // Check if this is a new user welcome
    (function() {
      const urlParams = new URLSearchParams(window.location.search);
      const isWelcome = urlParams.get('welcome') === 'true';
      
      if (isWelcome) {
        showWelcomeNotification();
        // Clean up URL without reloading page
        const url = new URL(window.location);
        url.searchParams.delete('welcome');
        window.history.replaceState({}, document.title, url.pathname + url.search);
      }
    })();

    function showWelcomeNotification() {
      const notification = document.createElement('div');
      notification.className = 'welcome-notification';
      notification.innerHTML = \`
        <button class="close-btn" onclick="closeWelcomeNotification(this.parentElement)">&times;</button>
        <div>
          <strong>🎉 Welcome to Hangman!</strong><br>
          Your account has been created successfully. Enjoy the game!
        </div>
      \`;
      
      document.body.appendChild(notification);
      
      // Auto-hide after 5 seconds
      setTimeout(() => {
        if (notification.parentElement) {
          closeWelcomeNotification(notification);
        }
      }, 5000);
    }

    function closeWelcomeNotification(notification) {
      notification.classList.add('fade-out');
      setTimeout(() => {
        if (notification.parentElement) {
          notification.parentElement.removeChild(notification);
        }
      }, 300);
    }

    // Make closeWelcomeNotification global for onclick handler
    window.closeWelcomeNotification = closeWelcomeNotification;

    // Global timer state management
    window.gameTimerState = window.gameTimerState || {
      startTime: null,
      timeLimit: null,
      interval: null,
      gameId: null
    };

    // Countdown timer logic
    function initializeOrUpdateTimer() {
      const timerElement = document.getElementById('countdown-timer');
      const numberElement = document.getElementById('countdown-number');
      
      if (!timerElement || !numberElement) {
        // No timer element means game is not playing, clear any existing timer
        if (window.gameTimerState.interval) {
          clearInterval(window.gameTimerState.interval);
          window.gameTimerState.interval = null;
        }
        return;
      }
      
      const startTime = parseInt(timerElement.dataset.startTime);
      const timeLimit = parseInt(timerElement.dataset.timeLimit);
      const gameId = timerElement.dataset.gameId || 'unknown';
      
      if (!startTime || !timeLimit) return;
      
      // Check if this is a new game or same game
      const isNewGame = window.gameTimerState.gameId !== gameId || 
                        window.gameTimerState.startTime !== startTime;
      
      if (isNewGame) {
        // Clear old timer if exists
        if (window.gameTimerState.interval) {
          clearInterval(window.gameTimerState.interval);
        }
        
        // Update timer state for new game
        window.gameTimerState.startTime = startTime;
        window.gameTimerState.timeLimit = timeLimit;
        window.gameTimerState.gameId = gameId;
        
        // Start new timer
        startNewTimer();
      } else {
        // Same game, just update the display without restarting timer
        updateTimerDisplay();
      }
    }

    function startNewTimer() {
      function updateTimer() {
        const elapsedTime = (Date.now() - window.gameTimerState.startTime) / 1000;
        const remainingTime = Math.max(0, Math.ceil(window.gameTimerState.timeLimit - elapsedTime));
        
        updateTimerDisplay(remainingTime);
        
        // Auto-submit when time runs out
        if (remainingTime <= 0) {
          clearInterval(window.gameTimerState.interval);
          window.gameTimerState.interval = null;
          
          // Submit time expired request
          fetch('/game/time-expired', {
            method: 'POST',
            headers: {
              'HX-Request': 'true',
              'HX-Target': '#game-container'
            }
          }).then(response => response.text())
            .then(html => {
              const gameContainer = document.getElementById('game-container');
              gameContainer.outerHTML = html;
              
              // Process new content with HTMX
              const newContainer = document.getElementById('game-container');
              if (newContainer && window.htmx) {
                window.htmx.process(newContainer);
              }
            })
            .catch(error => {
              console.error('Error handling time expired:', error);
            });
          return;
        }
      }
      
      // Update immediately
      updateTimer();
      
      // Update every second
      window.gameTimerState.interval = setInterval(updateTimer, 1000);
    }

    function updateTimerDisplay(remainingTime) {
      const numberElement = document.getElementById('countdown-number');
      if (!numberElement) return;
      
      // Calculate remaining time if not provided
      if (remainingTime === undefined) {
        const elapsedTime = (Date.now() - window.gameTimerState.startTime) / 1000;
        remainingTime = Math.max(0, Math.ceil(window.gameTimerState.timeLimit - elapsedTime));
      }
      
      numberElement.textContent = remainingTime.toString();
      
      // Update color classes based on remaining time
      numberElement.className = 'countdown-number';
      if (remainingTime >= 21) {
        numberElement.classList.add('time-normal');
      } else if (remainingTime >= 11) {
        numberElement.classList.add('time-warning');
      } else {
        numberElement.classList.add('time-critical');
      }
    }

    // Initialize timer on page load
    initializeOrUpdateTimer();

    // Load daily limit info asynchronously
    function loadDailyLimitInfo() {
      const limitInfoElement = document.getElementById('daily-limit-info');
      if (limitInfoElement) {
        fetch('/api/daily-limit-info')
          .then(response => response.json())
          .then(data => {
            if (data.gamesRemaining !== undefined) {
              limitInfoElement.innerHTML = \`
                <div class="daily-limit-display">
                  <div class="limit-counter">
                    <span class="games-left">\${data.gamesRemaining}</span>
                    <span class="games-left-label">games left today</span>
                  </div>
                  \${data.gamesRemaining <= 1 ? '<div class="limit-warning">⚠️ Last game of the day!</div>' : ''}
                </div>
              \`;
            }
          })
          .catch(error => {
            console.error('Error loading daily limit info:', error);
            limitInfoElement.innerHTML = '';
          });
      }
    }

    // Load daily limit info on page load
    loadDailyLimitInfo();

    // Listen for HTMX events to reinitialize timer after updates
    document.addEventListener('htmx:afterSettle', function(event) {
      if (event.detail.target && event.detail.target.id === 'game-container') {
        initializeOrUpdateTimer();
        loadDailyLimitInfo();
      }
    });
  </script>
</body>
</html>
`;

export const gameComponent = (state: GameState): string => `
<div class="game-container" id="game-container">
  <!-- Top navigation bar -->
  <div class="game-header">
    <div class="game-title">
      <h2>Hangman</h2>
      ${state.username ? `<div class="user-info">Welcome, ${state.username.split('@')[0]}!</div>` : ''}
    </div>

    <!-- Countdown timer in center -->
    ${countdownTimer(state)}

    <div class="game-nav">
      <!-- Dashboard toggle button -->
      <button
        class="dashboard-toggle"
        aria-label="Toggle statistics dashboard"
        onclick="document.getElementById('game-stats').classList.toggle('visible');"
      >
        <span class="dashboard-icon">📊</span>
      </button>
      
      <!-- Standings button -->
      <button
        class="standings-button"
        aria-label="View Player Standings"
        onclick="window.location.href = '/standings'"
      >
        <span class="standings-icon">🏆</span>
      </button>
      
      <!-- New Game button - only active when game is finished -->
      <button
        class="new-game-nav ${state.status === 'playing' ? 'disabled' : ''}"
        aria-label="New Game"
        ${state.status === 'playing' ? 'disabled' : ''}
        hx-post="/new-game"
        hx-target="#game-container"
        hx-swap="outerHTML"
      >
        <span class="new-game-icon">🔄</span>
      </button>
      
      ${state.username ? `
        <!-- Logout button -->
        <button
          class="logout-button"
          aria-label="Logout"
          onclick="fetch('/auth/logout', {method: 'POST'}).then(() => window.location.href = '/login')"
        >
          <span class="logout-icon">🚪</span>
        </button>
      ` : ''}
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
    .with("won", () => {
      const baseMessage = `🎉 You didi it! The word was ${state.word}.`;
      const sequenceMessage = state.winSequenceNumber 
        ? `<br><span class="win-sequence">🏅 You are winner #${state.winSequenceNumber}!</span>`
        : "";
      return [`${baseMessage}${sequenceMessage}`, "win"];
    })
    .with("lost", () => {
      // Check if the game was lost due to time expiration
      const isTimeExpired = state.endTime && 
        (state.endTime - state.startTime) / 1000 >= state.timeLimit &&
        state.wrongGuesses < state.maxWrong;
      
      const message = isTimeExpired 
        ? `⏰ Time's Up! The word was ${state.word}.`
        : `Game Over! The word was ${state.word}.`;
      
      return [message, "lose"];
    })
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
    
    ${state.username ? `
    <div id="daily-limit-info" class="daily-limit-info">
      <div class="loading-text">Loading daily limit info...</div>
    </div>
    ` : ''}
    
    ${state.winSequenceNumber ? `
    <div class="recent-win-info">
      <h4>🏆 Recent Achievement</h4>
      <div class="achievement-badge">
        You are the <strong>#${state.winSequenceNumber}</strong> person to successfully complete this challenge!
      </div>
    </div>
    ` : ''}
    
    <div class="leaderboard-note">
      <small>📊 Global win tracking helps celebrate everyone's success!</small>
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

/**
 * Countdown timer component
 */
export const countdownTimer = (state: GameState): string => {
  if (state.status !== "playing") {
    return `<div class="countdown-timer" style="visibility: hidden;"></div>`;
  }

  const elapsedTime = (Date.now() - state.startTime) / 1000; // in seconds
  const remainingTime = Math.max(0, Math.ceil(state.timeLimit - elapsedTime));

  return `
  <div class="countdown-timer" id="countdown-timer" data-start-time="${state.startTime}" data-time-limit="${state.timeLimit}" data-game-id="${state.id}">
    <div class="countdown-display">
      <span class="countdown-number" id="countdown-number">${remainingTime}</span>
      <span class="countdown-label">seconds left</span>
    </div>
  </div>
  `;
};

/**
 * Player standings component
 */
export const playerStandings = (standings: any[], currentUser?: string): string => {
  if (!standings || standings.length === 0) {
    return `
    <div class="player-standings">
      <h3>🏆 Player Standings</h3>
      <div class="standings-empty">
        <p>No players have won games yet. Be the first!</p>
      </div>
    </div>
    `;
  }

  return `
  <div class="player-standings">
    <div class="standings-header-bar">
      <button class="back-to-game-button" onclick="window.location.href = '/'">
        ← Back to Game
      </button>
      <h3>🏆 Player Standings</h3>
      <div></div>
    </div>
    
    <div class="standings-header">
      <span class="rank-header">Rank</span>
      <span class="player-header">Player</span>
      <span class="wins-header">Wins</span>
      <span class="time-header">Avg Time</span>
    </div>
    <div class="standings-list">
      ${standings.map((standing, index) => `
        <div class="standing-row ${standing.username === currentUser ? 'current-user' : ''}">
          <span class="rank">${index + 1}</span>
          <span class="player-name">${standing.displayName}</span>
          <span class="wins">${standing.totalWins}</span>
          <span class="avg-time">${standing.averageTime}s</span>
        </div>
      `).join('')}
    </div>
    <div class="standings-note">
      <small>Ranked by total wins, then by average completion time</small>
    </div>
  </div>
  `;
};

/**
 * Daily limit reached component
 */
export const dailyLimitReached = (gamesPlayed: number, gamesRemaining: number, username?: string): string => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const resetTime = tomorrow.toLocaleString();

  return `
  <div class="daily-limit-container">
    <div class="limit-message">
      <h2>🎯 Daily Game Limit Reached</h2>
      <div class="limit-details">
        <div class="games-played">
          <span class="limit-number">${gamesPlayed}</span>
          <span class="limit-label">Games Played Today</span>
        </div>
        <div class="limit-separator">of</div>
        <div class="games-total">
          <span class="limit-number">5</span>
          <span class="limit-label">Daily Maximum</span>
        </div>
      </div>
      
      <div class="reset-info">
        <p>🕛 Your daily games will reset at midnight</p>
        <p class="reset-time">Come back tomorrow to continue playing!</p>
      </div>

      <div class="limit-actions">
        <button class="standings-link-button" onclick="window.location.href = '/standings'">
          🏆 View Player Standings
        </button>
        
        ${username ? `
          <button class="logout-link-button" onclick="fetch('/auth/logout', {method: 'POST'}).then(() => window.location.href = '/login')">
            🚪 Logout
          </button>
        ` : ''}
      </div>
      
      <div class="limit-note">
        <small>Daily limits help ensure fair gameplay and encourage balanced gaming habits.</small>
      </div>
    </div>
  </div>
  `;
};

/**
 * Games remaining indicator for active games
 */
export const gamesRemainingIndicator = async (username: string): Promise<string> => {
  try {
    const { checkDailyLimit } = await import("../auth/kv.ts");
    const limitCheck = await checkDailyLimit(username);
    
    return `
    <div class="games-remaining">
      <span class="remaining-count">${limitCheck.gamesRemaining}</span>
      <span class="remaining-label">games remaining today</span>
    </div>
    `;
  } catch (error) {
    console.error("Error getting games remaining:", error);
    return '';
  }
};

/**
 * Welcome screen component for users with no active game
 */
export const welcomeScreen = (username?: string): string => {
  return `
  <div class="game-container" id="game-container">
    <!-- Top navigation bar -->
    <div class="game-header">
      <div class="game-title">
        <h2>Hangman</h2>
        ${username ? `<div class="user-info">Welcome, ${username.split('@')[0]}!</div>` : ''}
      </div>

      <!-- Empty space where countdown would be -->
      <div class="countdown-timer" style="visibility: hidden;"></div>

      <div class="game-nav">
        <!-- Dashboard toggle button (disabled on welcome screen) -->
        <button
          class="dashboard-toggle disabled"
          aria-label="Toggle statistics dashboard"
          disabled
        >
          <span class="dashboard-icon">📊</span>
        </button>
        
        <!-- Standings button -->
        <button
          class="standings-button"
          aria-label="View Player Standings"
          onclick="window.location.href = '/standings'"
        >
          <span class="standings-icon">🏆</span>
        </button>
        
        <!-- New Game button - active on welcome screen -->
        <button
          class="new-game-nav"
          aria-label="Start New Game"
          hx-post="/new-game"
          hx-target="#game-container"
          hx-swap="outerHTML"
        >
          <span class="new-game-icon">🔄</span>
        </button>
        
        ${username ? `
          <!-- Logout button -->
          <button
            class="logout-button"
            aria-label="Logout"
            onclick="fetch('/auth/logout', {method: 'POST'}).then(() => window.location.href = '/login')"
          >
            <span class="logout-icon">🚪</span>
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Welcome content -->
    <div class="welcome-content">
      <div class="welcome-message">
        <h2>🎯 Ready to Play Hangman?</h2>
        ${username ? `
          <p>Welcome back, <strong>${username.split('@')[0]}</strong>!</p>
        ` : ''}
        <p>Click the <strong>🔄 New Game</strong> button above to begin your hangman challenge.</p>
        
        <div class="game-rules">
          <h3>📋 Game Rules</h3>
          <ul>
            <li>🎲 Guess the hidden word letter by letter</li>
            <li>⏰ You have <strong>60 seconds</strong> to complete each game</li>
            <li>💡 Use hints wisely - you get <strong>1 hint</strong> per game</li>
            <li>🎮 Play up to <strong>5 games per day</strong></li>
            <li>🏆 Compete for the best completion times on the leaderboard</li>
          </ul>
        </div>
        
        ${username ? `
        <div id="daily-limit-info" class="daily-limit-info">
          <div class="loading-text">Loading daily limit info...</div>
        </div>
        ` : ''}
      </div>
    </div>
  </div>
  `;
};