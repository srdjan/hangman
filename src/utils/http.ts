import { CONTENT_TYPE, SESSION_CONFIG, HTTP_STATUS } from "../constants.ts";

/**
 * HTTP response utilities to eliminate duplication of headers and response creation
 */

// Cookie configuration constants
export const COOKIE_CONFIG = {
  MAX_AGE: SESSION_CONFIG.MAX_AGE,
  ATTRIBUTES: "Path=/; HttpOnly; SameSite=Strict"
} as const;

/**
 * Create an HTML response with standard headers
 */
export function createHtmlResponse(
  content: string, 
  additionalHeaders?: Record<string, string>,
  status: number = 200
): Response {
  const headers = new Headers({
    "Content-Type": CONTENT_TYPE.HTML,
    ...additionalHeaders
  });
  
  return new Response(content, { status, headers });
}

/**
 * Create a JSON response with standard headers
 */
export function createJsonResponse(
  data: any, 
  status: number = 200,
  additionalHeaders?: Record<string, string>
): Response {
  const headers = new Headers({
    "Content-Type": CONTENT_TYPE.JSON,
    ...additionalHeaders
  });
  
  return new Response(JSON.stringify(data), { status, headers });
}

/**
 * Create a game session cookie string
 */
export function createGameCookie(sessionId: string): string {
  return `hangman_session=${sessionId}; ${COOKIE_CONFIG.ATTRIBUTES}; Max-Age=${COOKIE_CONFIG.MAX_AGE}`;
}

/**
 * Create an authentication cookie string
 */
export function createAuthCookie(sessionId: string): string {
  return `auth_session=${sessionId}; ${COOKIE_CONFIG.ATTRIBUTES}; Max-Age=${COOKIE_CONFIG.MAX_AGE}`;
}

/**
 * Create standard HTML headers with optional additional headers
 */
export function createHtmlHeaders(additionalHeaders?: Record<string, string>): Headers {
  return new Headers({
    "Content-Type": CONTENT_TYPE.HTML,
    ...additionalHeaders
  });
}

/**
 * Create an HTML response with a game session cookie
 */
export function createHtmlResponseWithSession(
  content: string,
  sessionId: string,
  additionalHeaders?: Record<string, string>,
  status: number = 200
): Response {
  const headers = createHtmlHeaders({
    "Set-Cookie": createGameCookie(sessionId),
    ...additionalHeaders
  });
  
  return new Response(content, { status, headers });
}

/**
 * Create an error response with consistent formatting
 */
export function createErrorResponse(
  message: string, 
  status: number = 500,
  format: 'html' | 'json' = 'html'
): Response {
  if (format === 'json') {
    return createJsonResponse({ error: message }, status);
  }
  
  return createHtmlResponse(`Error: ${message}`, undefined, status);
}

/**
 * Create a static file response with appropriate content type
 */
export function createStaticResponse(
  content: string | Uint8Array,
  filePath: string
): Response {
  let contentType = CONTENT_TYPE.PLAIN_TEXT;
  
  if (filePath.endsWith('.css')) {
    contentType = CONTENT_TYPE.CSS;
  } else if (filePath.endsWith('.js')) {
    contentType = CONTENT_TYPE.JAVASCRIPT;
  } else if (filePath.endsWith('.html')) {
    contentType = CONTENT_TYPE.HTML;
  }
  
  return new Response(content, {
    headers: { "Content-Type": contentType }
  });
}