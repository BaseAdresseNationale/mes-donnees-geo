import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: ["prisma/migrations/**", "src/generated/**"],
  },
  {
    rules: {
      // Utiliser les modales de @gouvfr-lasuite/ui-components (useModals) à la place.
      "no-alert": "error",
    },
  },
];

export default eslintConfig;
