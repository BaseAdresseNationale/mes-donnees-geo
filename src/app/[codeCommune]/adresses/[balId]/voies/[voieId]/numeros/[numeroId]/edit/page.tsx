import { requireBalClient, requireBalNumero } from "@/lib/api-bal/bal-client";
import { findBaseLocaleToponymes } from "@/lib/api-bal/generated/sdk.gen";
import type { Numero } from "@/lib/api-bal/generated/types.gen";
import { BboxMapEffects } from "@/components/adresses/detail/BboxMapEffects";
import { NumeroForm } from "@/components/adresses/numero/NumeroForm";

// Emprise [minLng, minLat, maxLng, maxLat] des positions du numéro
function positionsBbox(numero: Numero): number[] | null {
  const points = numero.positions.flatMap((position) => {
    const coordinates = (position.point as { coordinates?: unknown })
      .coordinates;
    return Array.isArray(coordinates) && coordinates.length >= 2
      ? [coordinates as number[]]
      : [];
  });
  if (points.length === 0) return null;
  const lngs = points.map(([lng]) => lng);
  const lats = points.map(([, lat]) => lat);
  return [
    Math.min(...lngs),
    Math.min(...lats),
    Math.max(...lngs),
    Math.max(...lats),
  ];
}

export default async function NumeroEditPage({
  params,
}: {
  params: Promise<{
    codeCommune: string;
    balId: string;
    voieId: string;
    numeroId: string;
  }>;
}) {
  const { codeCommune, balId, voieId, numeroId } = await params;

  const [numero, { data: toponymes }] = await Promise.all([
    requireBalNumero(balId, voieId, numeroId),
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
      <BboxMapEffects bbox={positionsBbox(numero)} />
      <NumeroForm
        balId={balId}
        voieId={voieId}
        numero={numero}
        // Seuls id et nom servent au choix du toponyme
        toponymes={toponymes
          .map(({ id, nom }) => ({ id, nom }))
          .sort((a, b) => a.nom.localeCompare(b.nom, "fr"))}
        voieHref={`/${codeCommune}/adresses/${balId}/voies/${voieId}`}
      />
    </>
  );
}
