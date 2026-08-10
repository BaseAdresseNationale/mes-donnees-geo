import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// dotenv/config par défaut ne charge que ".env" ; le projet utilise ".env.local".
config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // process.env direct (et non env()) pour ne pas faire échouer `prisma generate`
    // quand DATABASE_URL n'est pas encore défini (ex: CI, premier install).
    url: process.env.DATABASE_URL ?? "",
  },
});
