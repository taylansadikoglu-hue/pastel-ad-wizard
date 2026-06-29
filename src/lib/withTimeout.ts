/** Race a promise against a timeout; resolves with fallback instead of hanging forever. */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
  label = "operation",
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => {
          console.warn(`[withTimeout] ${label} exceeded ${ms}ms — using fallback`);
          resolve(fallback);
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
