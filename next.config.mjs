/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  transpilePackages: [
    "@gouvfr-lasuite/ui-components",
    "@gouvfr-lasuite/ui-tokens",
  ],
};

export default nextConfig;
