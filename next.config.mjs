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
      new URL(`${process.env.NEXT_PUBLIC_PANORAMAX_API_URL}/**`),
      new URL(
        `${process.env.NEXT_PUBLIC_BUCKET_ANNUAIRE_DES_COLLECTIVITES}/**`,
      ),
    ],
  },
};

export default nextConfig;
