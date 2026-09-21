export async function waitFor<T>(
  check: () => Promise<T | null | undefined>,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 5000;
  const intervalMs = options.intervalMs ?? 200;
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const result = await check();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`waitFor: condition not met within ${timeoutMs}ms`);
}