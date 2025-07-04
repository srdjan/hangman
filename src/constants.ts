/**
 * Application constants to eliminate magic numbers and hardcoded strings
 * Centralizes configuration values for easy maintenance
 */

// Game Configuration
export const GAME_CONFIG = {
  // Time limits in seconds
  TIME_LIMIT: 60,
  DEFAULT_TIME_LIMIT: 60,
  
  // Difficulty settings
  DEFAULT_DIFFICULTY: "hard",
  DEFAULT_CATEGORY: "Words",
  DEFAULT_WORD_COUNT: 1,
  
  // Daily limits
  DAILY_GAME_LIMIT: 10,
  
  // Hint system
  MAX_HINTS_PER_GAME: 3,
  
  // Display settings
  MAX_WORD_LENGTH: 20,
  MIN_WORD_LENGTH: 3
} as const;

// Session Configuration
export const SESSION_CONFIG = {
  // Cookie settings
  MAX_AGE: 3600, // 1 hour in seconds
  COOKIE_NAME: 'hangman_session',
  AUTH_COOKIE_NAME: 'auth_session',
  
  // Session validation
  SESSION_TIMEOUT: 3600000, // 1 hour in milliseconds
  CLEANUP_INTERVAL: 300000   // 5 minutes in milliseconds
} as const;

// Authentication Constants
export const AUTH_CONFIG = {
  // Email validation - supports multiple domains
  DISPLAY_EMAIL_DOMAIN: 'fadv.com',
  ALLOWED_EMAIL_DOMAINS: ['fadv.com', 'deno.dev', 'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'],
  EMAIL_REGEX: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  EMAIL_PATTERN: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
  
  // WebAuthn settings
  WEBAUTHN_TIMEOUT: 60000, // 1 minute
  CHALLENGE_LENGTH: 32,
  
  // Rate limiting
  MAX_AUTH_ATTEMPTS: 5,
  RATE_LIMIT_WINDOW: 900000 // 15 minutes
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;

// Content Types
export const CONTENT_TYPE = {
  HTML: 'text/html; charset=utf-8',
  JSON: 'application/json',
  CSS: 'text/css',
  JAVASCRIPT: 'text/javascript',
  PLAIN_TEXT: 'text/plain'
} as const;

// CSS Class Names
export const CSS_CLASSES = {
  // Layout
  GAME_CONTAINER: 'game-container',
  GAME_HEADER: 'game-header',
  GAME_MAIN: 'game-main',
  GAME_NAV: 'game-nav',
  
  // Components
  HANGMAN_DISPLAY: 'hangman-display',
  WORD_DISPLAY: 'word-display',
  LETTER: 'letter',
  KEYBOARD: 'keyboard',
  
  // States
  STATUS_WIN: 'status win',
  STATUS_LOSE: 'status lose',
  GAME_OVER: 'game-over',
  VISIBLE: 'visible',
  ACTIVE: 'active',
  
  // Buttons
  BUTTON_CORRECT: 'correct',
  BUTTON_INCORRECT: 'incorrect',
  HINT_BUTTON: 'hint-button',
  NEW_GAME_NAV: 'new-game-nav',
  
  // Modals
  GAME_STATS: 'game-stats',
  PLAYER_STANDINGS_MODAL: 'player-standings-modal',
  
  // Notifications
  WELCOME_NOTIFICATION: 'welcome-notification',
  ERROR_MESSAGE: 'error-message',
  
  // Auth
  AUTH_CONTAINER: 'auth-container',
  AUTH_CARD: 'auth-card',
  USERNAME_INPUT: 'username-input',
  AUTH_BUTTON: 'auth-button',
  
  // Daily limit
  DAILY_LIMIT_CONTAINER: 'daily-limit-container',
  LIMIT_MESSAGE: 'limit-message',
  
  // Timer
  COUNTDOWN_TIMER: 'countdown-timer',
  COUNTDOWN_NUMBER: 'countdown-number',
  TIME_NORMAL: 'time-normal',
  TIME_WARNING: 'time-warning',
  TIME_CRITICAL: 'time-critical'
} as const;

// UI Messages
export const MESSAGES = {
  // Game states
  GAME_WON: 'Congratulations! You won!',
  GAME_LOST: 'Game Over! Better luck next time.',
  TIME_EXPIRED: 'Time\'s up! Game over.',
  
  // Errors
  INVALID_LETTER: 'Invalid letter',
  NO_ACTIVE_GAME: 'No active game',
  NOT_AUTHENTICATED: 'Not authenticated',
  AUTHENTICATION_FAILED: 'Authentication failed',
  REGISTRATION_FAILED: 'Registration failed',
  
  // Daily limits
  DAILY_LIMIT_REACHED: 'Daily game limit reached',
  GAMES_REMAINING: 'games remaining today',
  
  // Loading states
  LOADING_STATS: 'Loading statistics...',
  LOADING_STANDINGS: 'Loading standings...',
  
  // Success messages
  STATS_UPDATED: 'Statistics updated successfully',
  STANDINGS_UPDATED: 'Standings updated successfully',
  
  // Validation
  INVALID_EMAIL: 'Please enter a valid @fadv.com email address',
  EMAIL_REQUIRED: 'Please enter an email address'
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  // Game endpoints
  GAME: '/',
  NEW_GAME: '/new-game',
  GUESS: '/guess',
  HINT: '/hint',
  TIME_EXPIRED: '/game/time-expired',
  
  // API endpoints
  DAILY_LIMIT_INFO: '/api/daily-limit-info',
  STANDINGS: '/api/standings',
  USER_STATS: '/api/user-stats',
  
  // Auth endpoints
  LOGIN: '/login',
  REGISTER_OPTIONS: '/auth/register/options',
  REGISTER_VERIFY: '/auth/register/verify',
  LOGIN_OPTIONS: '/auth/login/options',
  LOGIN_VERIFY: '/auth/login/verify',
  CONDITIONAL_OPTIONS: '/auth/conditional/options',
  CONDITIONAL_VERIFY: '/auth/conditional/verify',
  IDENTIFY: '/auth/identify',
  LOGOUT: '/auth/logout',
  
  // Static endpoints
  STATIC: '/static/*'
} as const;

// File Paths
export const FILE_PATHS = {
  // Static files
  STYLES_CSS: 'styles.css',
  KEYBOARD_JS: 'keyboard.js',
  
  // Templates
  LOGIN_PAGE: 'loginPage',
  HOME_PAGE: 'homePage',
  
  // Directories
  STATIC_DIR: './static',
  SRC_STATIC_DIR: './src/static',
  VIEWS_DIR: './src/views'
} as const;

// Server Configuration
export const SERVER_CONFIG = {
  // Default ports
  DEFAULT_PORT: 8001,
  
  // Timeouts
  REQUEST_TIMEOUT: 30000, // 30 seconds
  
  // Performance
  MAX_REQUEST_SIZE: 10485760, // 10MB
  
  // Environment
  DEVELOPMENT: 'development',
  PRODUCTION: 'production'
} as const;

// Regex Patterns
export const REGEX_PATTERNS = {
  // Letter validation
  LETTER: /^[A-Z]$/,
  LETTERS_ONLY: /^[A-Za-z]+$/,
  
  // Email validation
  EMAIL: AUTH_CONFIG.EMAIL_REGEX,
  
  // File extensions
  CSS_FILE: /\.css$/,
  JS_FILE: /\.js$/,
  HTML_FILE: /\.html$/,
  
  // Path validation
  STATIC_PATH: /^\/static\//,
  API_PATH: /^\/api\//,
  AUTH_PATH: /^\/auth\//
} as const;

// Game Difficulty Settings
export const DIFFICULTY = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard'
} as const;

// Game Categories
export const CATEGORIES = {
  WORDS: 'Words',
  ANIMALS: 'Animals',
  COUNTRIES: 'Countries',
  GENERAL: 'General'
} as const;

// Log Levels and Contexts (duplicated from logger for independence)
export const LOG_LEVELS = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR'
} as const;

export const LOG_CONTEXTS = {
  GAME: 'GAME',
  AUTH: 'AUTH',
  API: 'API',
  STATS: 'STATS',
  SESSION: 'SESSION',
  STATIC: 'STATIC',
  WEBAUTHN: 'WEBAUTHN',
  DATABASE: 'DATABASE',
  PERFORMANCE: 'PERFORMANCE'
} as const;

// Timer Constants
export const TIMER = {
  // Game timer thresholds
  WARNING_THRESHOLD: 20, // seconds
  CRITICAL_THRESHOLD: 10, // seconds
  
  // Update intervals
  TIMER_UPDATE_INTERVAL: 100, // milliseconds
  PERFORMANCE_CHECK_INTERVAL: 1000, // milliseconds
  
  // Animation durations
  ANIMATION_DURATION: 300, // milliseconds
  TRANSITION_SPEED: 300 // milliseconds
} as const;

// Responsive Breakpoints
export const BREAKPOINTS = {
  MOBILE: 600, // pixels
  TABLET: 768, // pixels
  DESKTOP: 1024 // pixels
} as const;