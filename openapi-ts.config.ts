import { config } from "dotenv";
import { defineConfig } from "@hey-api/openapi-ts";

// dotenv/config par défaut ne charge que ".env" ; le projet utilise ".env.local".
config({ path: ".env.local" });

// Génère le client typé de mes-adresses-api dans src/lib/api-bal/generated,
// à partir du Swagger exposé par l'API (<NEXT_PUBLIC_MES_ADRESSES_API_URL>/api-json).
export default defineConfig({
  input: `${process.env.NEXT_PUBLIC_MES_ADRESSES_API_URL}/api-json`,
  output: "src/lib/api-bal/generated",
  plugins: ["@hey-api/client-fetch", "@hey-api/typescript", "@hey-api/sdk"],
});
