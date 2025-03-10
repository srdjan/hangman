import { err, ok, Result } from "./result.ts";

// Type-safe random element selection with proper error handling
export const getRandomElement = <T>(array: readonly T[]): Result<T, Error> => {
  if (array.length === 0) {
    return err(new Error("Cannot select from empty collection"));
  }

  const index = Math.floor(Math.random() * array.length);
  const element = array[index];

  // Explicit narrowing for type safety
  if (element === undefined) {
    return err(new Error(`Index access failed at position ${index}`));
  }

  return ok(element);
};

