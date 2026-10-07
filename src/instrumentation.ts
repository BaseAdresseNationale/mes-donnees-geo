export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBdTopoImportPurge } = await import("@/lib/cron/bd-topo-import-purge");
    startBdTopoImportPurge();
  }
}