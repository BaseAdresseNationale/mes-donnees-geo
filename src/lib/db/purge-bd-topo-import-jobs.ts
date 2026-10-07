import "server-only";
import { prisma } from "./prisma";

const RETENTION_MS = 24 * 60 * 60 * 1000;

export async function purgeBdTopoImportJobs(now = new Date()): Promise<number> {
  const result = await prisma.bdTopoImportJob.deleteMany({
    where: {
      status: { in: ["succeeded", "failed"] },
      finishedAt: { lt: new Date(now.getTime() - RETENTION_MS) },
    },
  });
  return result.count;
}
