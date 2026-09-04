/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  transpilePackages: [
    "@gouvfr-lasuite/ui-components",
    "@gouvfr-lasuite/ui-tokens",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: new URL(process.env.NEXT_PUBLIC_PANORAMAX_API_URL).hostname,
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: new URL(
          process.env.NEXT_PUBLIC_BUCKET_ANNUAIRE_DES_COLLECTIVITES,
        ).hostname,
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
