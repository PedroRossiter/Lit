export type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  factor?: number;
  onRetry?: (attempt: number, error: unknown) => void;
};

// Retry com backoff exponencial. Lanca o ultimo erro se todas as tentativas falharem.
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 1000, factor = 2, onRetry } = options;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;
      onRetry?.(attempt, error);
      const delay = baseDelayMs * factor ** (attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}
