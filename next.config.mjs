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
      new URL(
        "https://base-adresse-locale-prod-blasons-communes.s3.fr-par.scw.cloud/**",
      ),
      new URL(`${process.env.NEXT_PUBLIC_PANORAMAX_API_URL}/**`),
      new URL(
        "https://annuaire-des-collectivites-production-storage.s3.fr-par.scw.cloud/**",
      ),
    ],
  },
};

export default nextConfig;
