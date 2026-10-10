type JsonRequestOptions = {
  timeoutMs?: number;
  timeoutMessage?: string;
  networkMessage?: string;
};

/** Keep the deadline active until the response body has been read, not just its headers. */
export async function fetchClientJson<T = unknown>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: JsonRequestOptions = {},
): Promise<{ response: Response; data: T }> {
  const controller = new AbortController();
  const parentSignal = init.signal;
  const timeoutMs = options.timeoutMs ?? 15_000;
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectCancellation: (error: Error) => void = () => {};
  const cancellation = new Promise<never>((_, reject) => { rejectCancellation = reject; });
  const abortFromParent = () => {
    controller.abort();
    rejectCancellation(new DOMException("La demande a été annulée.", "AbortError"));
  };
  if (parentSignal?.aborted) abortFromParent();
  else parentSignal?.addEventListener("abort", abortFromParent, { once: true });

  timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
    rejectCancellation(new Error(options.timeoutMessage ?? "Le serveur met trop de temps à répondre. Réessayez dans un instant."));
  }, timeoutMs);

  try {
    const request = (async () => {
      const response = await fetch(input, { ...init, signal: controller.signal });
      let data: T;
      try { data = await response.json() as T; }
      catch (error) {
        if (controller.signal.aborted) throw error;
        throw new Error("La réponse du serveur n’a pas pu être lue. Réessayez dans un instant.");
      }
      return { response, data };
    })();
    return await Promise.race([request, cancellation]);
  } catch (error) {
    if (timedOut) throw new Error(options.timeoutMessage ?? "Le serveur met trop de temps à répondre. Réessayez dans un instant.");
    if (parentSignal?.aborted) throw new DOMException("La demande a été annulée.", "AbortError");
    if (error instanceof TypeError) throw new Error(options.networkMessage ?? "La connexion au serveur a été interrompue. Vérifiez votre connexion puis réessayez.");
    throw error;
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener("abort", abortFromParent);
  }
}
