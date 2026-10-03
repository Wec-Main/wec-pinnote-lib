export class RequestTimeoutError extends Error {
  constructor(message = "The request took too long. Try again.") {
    super(message);
    this.name = "RequestTimeoutError";
  }
}

export function withRequestTimeout<T>(
  signal: AbortSignal,
  ms: number,
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal.aborted) controller.abort();
  else signal.addEventListener("abort", onAbort, { once: true });
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort();
      reject(new RequestTimeoutError());
    }, ms);
    work(controller.signal).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  }).finally(() => signal.removeEventListener("abort", onAbort));
}
