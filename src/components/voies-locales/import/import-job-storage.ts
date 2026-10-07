const CHANGE_EVENT = "bd-topo-import-change";
const fallback = new Map<string, string>();

export function readImportJob(key: string): string | null {
  try {
    return sessionStorage.getItem(key) ?? fallback.get(key) ?? null;
  } catch {
    return fallback.get(key) ?? null;
  }
}

export function writeImportJob(key: string, id: string | null): void {
  if (id) fallback.set(key, id);
  else fallback.delete(key);
  try {
    if (id) sessionStorage.setItem(key, id);
    else sessionStorage.removeItem(key);
  } catch {}
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeImportJob(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function serverImportJob(): null {
  return null;
}