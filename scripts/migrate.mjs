#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  console.error("DATABASE_URL manquante.");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "..", "migrations");

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`);

const files = (await readdir(MIGRATIONS_DIR))
  .filter((f) => f.endsWith(".sql"))
  .sort();

let applied = 0;
for (const file of files) {
  const { rows } = await client.query(
    "SELECT 1 FROM schema_migrations WHERE id = $1",
    [file],
  );
  if (rows.length > 0) {
    console.log(`✓ ${file} (déjà appliquée)`);
    continue;
  }
  const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
  console.log(`→ application de ${file}...`);
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
    await client.query("COMMIT");
    console.log(`✓ ${file}`);
    applied += 1;
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`✗ ${file}`);
    console.error(err);
    process.exit(1);
  }
}

await client.end();
console.log(applied === 0 ? "Aucune migration à appliquer." : `${applied} migration(s) appliquée(s).`);
