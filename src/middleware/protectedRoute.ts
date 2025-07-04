import { requireAuth } from "./auth.ts";
import { AuthState } from "../auth/types.ts";

/**
 * Type definition for route handlers that require authentication
 */
export type AuthenticatedHandler = (
  request: Request, 
  params: Record<string, string>, 
  authState: AuthState
) => Promise<Response>;

/**
 * Type definition for standard route handlers
 */
export type RouteHandler = (
  request: Request, 
  params: Record<string, string>
) => Promise<Response>;

/**
 * Higher-order function that wraps a handler with authentication protection
 * 
 * This eliminates the need for separate protected handler functions by:
 * 1. Performing authentication check
 * 2. Redirecting to login if not authenticated
 * 3. Calling the actual handler with auth state if authenticated
 * 
 * @param handler - The handler function that requires authentication
 * @returns A protected route handler
 */
export function withAuth(handler: AuthenticatedHandler): RouteHandler {
  return async (request: Request, params: Record<string, string>): Promise<Response> => {
    // Perform authentication check
    const authResult = await requireAuth(request);
    
    // If authResult is a Response, it means authentication failed
    // and we should redirect to login
    if (authResult instanceof Response) {
      return authResult;
    }
    
    // Authentication succeeded, call the actual handler with auth state
    return handler(request, params, authResult);
  };
}

/**
 * Convenience function to create multiple protected handlers at once
 * Useful for batch processing route definitions
 */
export function createProtectedHandlers<T extends Record<string, AuthenticatedHandler>>(
  handlers: T
): Record<keyof T, RouteHandler> {
  const protectedHandlers = {} as Record<keyof T, RouteHandler>;
  
  for (const [name, handler] of Object.entries(handlers)) {
    protectedHandlers[name as keyof T] = withAuth(handler);
  }
  
  return protectedHandlers;
}

/**
 * Type guard to check if a route requires authentication
 */
export function isAuthenticatedHandler(
  handler: RouteHandler | AuthenticatedHandler
): handler is AuthenticatedHandler {
  return handler.length === 3; // AuthenticatedHandler has 3 parameters
}