// Authentication configuration - using fixed values for development
export const AUTH_CONFIG = {
  ORIGIN: "http://localhost:8001",
  RP_ID: "localhost",
  RP_NAME: "Hangman Game",
  SESSION_TTL_MS: 1000 * 60 * 60 * 24, // 24 hours
  RATE_LIMIT_WINDOW_MS: 1000 * 60, // 1 minute
  RATE_LIMIT_MAX_REQ: 30, // max requests per window
} as const;