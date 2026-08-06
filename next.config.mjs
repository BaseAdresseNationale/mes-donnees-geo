/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@gouvfr-lasuite/ui-components",
    "@gouvfr-lasuite/ui-tokens",
  ],
};

export default nextConfig;
