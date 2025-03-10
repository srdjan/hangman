/**
 * Result<T, E> - Type-safe representation of operations that can succeed or fail
 */
export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/**
 * Create a successful result
 */
export const ok = <T>(value: T): Result<T> => ({
  ok: true,
  value
});

/**
 * Create a failed result
 */
export const err = <E = Error>(error: E): Result<never, E> => ({
  ok: false,
  error
});

/**
 * Safely execute a function that might throw and return a Result
 */
export const tryResult = <T>(fn: () => T): Result<T> => {
  try {
    return ok(fn());
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
};

/**
 * Map over the success value of a Result
 */
// export const mapResult = <T, U, E>(
//   result: Result<T, E>,
//   mapper: (value: T) => U
// ): Result<U, E> =>
//   result.ok ? ok(mapper(result.value)) : result;

/**
 * Chain multiple Result operations together
 */
export const bindResult = <T, U, E>(
  result: Result<T, E>,
  binder: (value: T) => Result<U, E>
): Result<U, E> =>
  result.ok ? binder(result.value) : result;

/**
 * Get the value from a Result or return a default
 */
export const unwrapOr = <T, E>(result: Result<T, E>, defaultValue: T): T =>
  result.ok ? result.value : defaultValue;

/**
 * Get the value from a Result or throw if it's an error
 * @throws The error contained in the Result if it's a failure
 */
export const unwrap = <T, E extends Error>(result: Result<T, E>): T => {
  if (!result.ok) throw result.error;
  return result.value;
};