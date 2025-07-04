// Authentication configuration - dynamic domain detection
function getWebAuthnConfig(request?: Request) {
  // Check if we're running on Deno Deploy (deno.dev)
  const isDenoDeployment = Deno.env.get("DENO_DEPLOYMENT_ID") !== undefined;
  
  if (isDenoDeployment) {
    // For Deno Deploy, dynamically detect the domain from the request
    if (request) {
      const url = new URL(request.url);
      return {
        ORIGIN: `${url.protocol}//${url.host}`,
        RP_ID: url.hostname,
      };
    } else {
      // Fallback to original domain if no request available
      return {
        ORIGIN: "https://hangman.deno.dev",
        RP_ID: "hangman.deno.dev",
      };
    }
  } else {
    // For local development, use localhost
    return {
      ORIGIN: "http://localhost:8001",
      RP_ID: "localhost",
    };
  }
}

// Default config for non-request contexts
const defaultWebAuthnConfig = getWebAuthnConfig();

export const AUTH_CONFIG = {
  ORIGIN: defaultWebAuthnConfig.ORIGIN,
  RP_ID: defaultWebAuthnConfig.RP_ID,
  RP_NAME: "Hangman Game",
  SESSION_TTL_MS: 1000 * 60 * 60 * 24, // 24 hours
  RATE_LIMIT_WINDOW_MS: 1000 * 60, // 1 minute
  RATE_LIMIT_MAX_REQ: 30, // max requests per window
} as const;

// Dynamic config function for request-specific contexts
export function getRequestAuthConfig(request: Request) {
  const webAuthnConfig = getWebAuthnConfig(request);
  return {
    ...AUTH_CONFIG,
    ORIGIN: webAuthnConfig.ORIGIN,
    RP_ID: webAuthnConfig.RP_ID,
  };
}