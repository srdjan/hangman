/**
 * Standardized logging and error handling utilities
 * Eliminates the 96+ repeated logging patterns across the codebase
 */

// Log levels for consistent formatting
export const LogLevel = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR'
} as const;

export type LogLevel = typeof LogLevel[keyof typeof LogLevel];

/**
 * Create a standardized log entry with consistent formatting
 */
function createLogEntry(level: LogLevel, context: string, message: string, data?: any): string {
  const timestamp = new Date().toISOString();
  const baseLog = `[${timestamp}] ${level} [${context}] ${message}`;
  
  if (data) {
    return `${baseLog} | Data: ${JSON.stringify(data)}`;
  }
  
  return baseLog;
}

/**
 * Log game events with structured format
 * Replaces scattered console.log statements with consistent format
 */
export function logGameEvent(event: string, data: any, context: string = 'GAME'): void {
  const logEntry = createLogEntry(LogLevel.INFO, context, `Game event: ${event}`, data);
  console.log(logEntry);
  
  // Also create structured log for parsing
  const structuredLog = {
    timestamp: new Date().toISOString(),
    level: LogLevel.INFO,
    context,
    event,
    data
  };
  
  console.log("STRUCTURED_LOG:", JSON.stringify(structuredLog));
}

/**
 * Log authentication events
 */
export function logAuthEvent(event: string, username: string, data?: any): void {
  logGameEvent(event, { username, ...data }, 'AUTH');
}

/**
 * Log API requests with consistent format
 */
export function logApiRequest(method: string, path: string, username?: string, data?: any): void {
  logGameEvent('api_request', { method, path, username, ...data }, 'API');
}

/**
 * Log errors with consistent format and context
 * Replaces scattered console.error statements
 */
export function logError(context: string, error: Error, additionalData?: any): void {
  const errorData = {
    message: error.message,
    stack: error.stack,
    name: error.name,
    ...additionalData
  };
  
  const logEntry = createLogEntry(LogLevel.ERROR, context, `Error occurred: ${error.message}`, errorData);
  console.error(logEntry);
  
  // Structured error log for monitoring systems
  const structuredLog = {
    timestamp: new Date().toISOString(),
    level: LogLevel.ERROR,
    context,
    error: errorData
  };
  
  console.error("STRUCTURED_ERROR:", JSON.stringify(structuredLog));
}

/**
 * Log warnings with consistent format
 */
export function logWarning(context: string, message: string, data?: any): void {
  const logEntry = createLogEntry(LogLevel.WARN, context, message, data);
  console.warn(logEntry);
}

/**
 * Log debug information (can be easily disabled in production)
 */
export function logDebug(context: string, message: string, data?: any): void {
  // Only log debug in development or when DEBUG flag is set
  if (Deno.env.get('DEBUG') === 'true' || Deno.env.get('NODE_ENV') === 'development') {
    const logEntry = createLogEntry(LogLevel.DEBUG, context, message, data);
    console.log(logEntry);
  }
}

/**
 * Safe async operation wrapper with standardized error handling
 * Eliminates repetitive try-catch blocks with identical error handling
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  context: string,
  errorMessage: string = 'Operation failed'
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    logError(context, error as Error, { operation: errorMessage });
    return null;
  }
}

/**
 * Safe async operation wrapper that throws on error but logs consistently
 */
export async function safeAsyncThrow<T>(
  operation: () => Promise<T>,
  context: string,
  errorMessage: string = 'Operation failed'
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    logError(context, error as Error, { operation: errorMessage });
    throw error;
  }
}

/**
 * Performance logging wrapper
 */
export async function logPerformance<T>(
  operation: () => Promise<T>,
  context: string,
  operationName: string
): Promise<T> {
  const startTime = performance.now();
  
  try {
    const result = await operation();
    const duration = performance.now() - startTime;
    
    logGameEvent('performance', {
      operation: operationName,
      duration: Math.round(duration),
      success: true
    }, context);
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    
    logGameEvent('performance', {
      operation: operationName,
      duration: Math.round(duration),
      success: false,
      error: (error as Error).message
    }, context);
    
    throw error;
  }
}

/**
 * Common logging contexts for consistency
 */
export const LogContext = {
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

/**
 * Game-specific logging helpers
 */
export const GameLogger = {
  /**
   * Log game creation
   */
  gameCreated(gameId: string, username: string, difficulty: string, category: string): void {
    logGameEvent('game_created', { gameId, username, difficulty, category });
  },

  /**
   * Log game completion
   */
  gameCompleted(gameId: string, username: string, result: 'won' | 'lost' | 'timeout', duration: number): void {
    logGameEvent('game_completed', { gameId, username, result, duration });
  },

  /**
   * Log guess made
   */
  guessMade(gameId: string, username: string, letter: string, correct: boolean): void {
    logGameEvent('guess_made', { gameId, username, letter, correct });
  },

  /**
   * Log hint used
   */
  hintUsed(gameId: string, username: string): void {
    logGameEvent('hint_used', { gameId, username });
  },

  /**
   * Log daily limit reached
   */
  dailyLimitReached(username: string, gamesPlayed: number): void {
    logGameEvent('daily_limit_reached', { username, gamesPlayed });
  }
} as const;