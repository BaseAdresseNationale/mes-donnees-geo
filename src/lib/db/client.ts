import "server-only";
import { Pool } from "pg";

const globalForPg = globalThis as unknown as { __pgPool?: Pool };

export function db(): Pool {
  if (!globalForPg.__pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL manquante.");
    }
    globalForPg.__pgPool = new Pool({ connectionString, max: 10 });
  }
  return globalForPg.__pgPool;
}
