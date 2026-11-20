const config = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "@swc/jest",
      {
        jsc: { parser: { syntax: "typescript" }, target: "es2022" },
        module: { type: "commonjs" },
      },
    ],
  },
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
};

export default config;
