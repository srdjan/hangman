// Authentication configuration - simplified for production domain
function getWebAuthnConfig() {
  // Check if we're running on Deno Deploy (deno.dev)
  const isDenoDeployment = Deno.env.get("DENO_DEPLOYMENT_ID") !== undefined;
  
  if (isDenoDeployment) {
    // For Deno Deploy, use the production domain
    return {
      ORIGIN: "https://hangman.deno.dev",
      RP_ID: "hangman.deno.dev",
    };
  } else {
    // For local development, use localhost
    return {
      ORIGIN: "http://localhost:8001",
      RP_ID: "localhost",
    };
  }
}

const webAuthnConfig = getWebAuthnConfig();

export const AUTH_CONFIG = {
  ORIGIN: webAuthnConfig.ORIGIN,
  RP_ID: webAuthnConfig.RP_ID,
  RP_NAME: "Hangman Game",
  SESSION_TTL_MS: 1000 * 60 * 60 * 24, // 24 hours
  RATE_LIMIT_WINDOW_MS: 1000 * 60, // 1 minute
  RATE_LIMIT_MAX_REQ: 30, // max requests per window
} as const;