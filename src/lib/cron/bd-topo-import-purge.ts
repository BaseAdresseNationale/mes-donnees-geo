import "server-only";
import { Cron } from "croner";
import { purgeBdTopoImportJobs } from "@/lib/db/purge-bd-topo-import-jobs";

const globalForCron = globalThis as unknown as {
  __bdTopoImportPurgeCron?: Cron;
};

export function startBdTopoImportPurge(): void {
  if (globalForCron.__bdTopoImportPurgeCron) return;

  globalForCron.__bdTopoImportPurgeCron = new Cron(
    "0 3 * * *",
    {
      timezone: "Europe/Paris",
      unref: true,
      protect: true,
      catch: (error) => console.error("BD TOPO job purge failed", error),
    },
    async () => {
      const count = await purgeBdTopoImportJobs();
      console.info("BD TOPO job purge completed", { deleted: count });
    },
  );
}
