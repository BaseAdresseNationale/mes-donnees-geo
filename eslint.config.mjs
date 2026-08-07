import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: ["prisma/migrations/**"],
  },
];

export default eslintConfig;
