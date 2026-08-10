import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: ["prisma/migrations/**", "src/generated/**"],
  },
];

export default eslintConfig;
