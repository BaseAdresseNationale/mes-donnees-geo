import type { AssembledLocalPathResponse } from "./types";

function waitForNextPoll(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, 2000);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function loadBdTopoPreview(
  signal: AbortSignal,
): Promise<AssembledLocalPathResponse[]> {
  const response = await fetch("/api/voies-locales/import/bd-topo", {
    signal,
    cache: "no-store",
  });
  const job = await response.json();
  if (!response.ok) {
    throw new Error(
      job.error ?? "Impossible de lancer la reconstitution des voies locales.",
    );
  }
  if (typeof job.jobId !== "string") {
    throw new Error("Réponse de reconstitution invalide.");
  }
  while (true) {
    signal.throwIfAborted();
    const statusResponse = await fetch(
      `/api/voies-locales/import/bd-topo/jobs/${encodeURIComponent(job.jobId)}`,
      { signal, cache: "no-store" },
    );
    const status = await statusResponse.json();
    if (!statusResponse.ok || status.status === "failed") {
      throw new Error(
        status.error ?? "Échec de la reconstitution des voies locales.",
      );
    }
    if (status.status === "succeeded") {
      if (!Array.isArray(status.result)) {
        throw new Error("Résultat de reconstitution invalide.");
      }
      return status.result;
    }
    await waitForNextPoll(signal);
  }
}
