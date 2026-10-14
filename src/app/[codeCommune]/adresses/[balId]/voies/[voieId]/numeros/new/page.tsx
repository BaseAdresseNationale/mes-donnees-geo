import { requireBalClient, requireBalVoie } from "@/lib/api-bal/bal-client";
import { findBaseLocaleToponymes } from "@/lib/api-bal/generated/sdk.gen";
import { BboxMapEffects } from "@/components/adresses/detail/BboxMapEffects";
import { NumeroForm } from "@/components/adresses/numero/NumeroForm";

// Centroïde [lon, lat] de la voie (null si elle n'a pas de géométrie)
function voieCentroid(centroid: unknown): [number, number] | null {
  const coordinates = (centroid as { coordinates?: unknown } | null)
    ?.coordinates;
  return Array.isArray(coordinates) &&
    coordinates.length >= 2 &&
    coordinates.every((n) => typeof n === "number")
    ? [coordinates[0], coordinates[1]]
    : null;
}

export default async function NumeroNewPage({
  params,
}: {
  params: Promise<{ codeCommune: string; balId: string; voieId: string }>;
}) {
  const { codeCommune, balId, voieId } = await params;

  const [voie, { data: toponymes }] = await Promise.all([
    requireBalVoie(balId, voieId),
    requireBalClient(balId).then((client) =>
      findBaseLocaleToponymes({
        client,
        path: { baseLocaleId: balId },
        throwOnError: true,
      }),
    ),
  ]);

  return (
    <>
      <BboxMapEffects bbox={voie.bbox} />
      <NumeroForm
        balId={balId}
        voieId={voieId}
        initialPosition={voieCentroid(voie.centroid)}
        toponymes={toponymes
          .map(({ id, nom }) => ({ id, nom }))
          .sort((a, b) => a.nom.localeCompare(b.nom, "fr"))}
        voieHref={`/${codeCommune}/adresses/${balId}/voies/${voieId}`}
      />
    </>
  );
}
