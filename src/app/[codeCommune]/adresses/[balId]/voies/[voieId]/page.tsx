import { requireBalClient, requireBalVoie } from "@/lib/api-bal/bal-client";
import { findVoieNumeros } from "@/lib/api-bal/generated/sdk.gen";
import { NameList } from "@/components/adresses/list/NameList";
import { DetailHeader } from "@/components/adresses/detail/DetailHeader";
import { BboxMapEffects } from "@/components/adresses/detail/BboxMapEffects";

export default async function VoiePage({
  params,
}: {
  params: Promise<{ codeCommune: string; balId: string; voieId: string }>;
}) {
  const { codeCommune, balId, voieId } = await params;
  const voieHref = `/${codeCommune}/adresses/${balId}/voies/${voieId}`;

  const [voie, { data: numeros }] = await Promise.all([
    requireBalVoie(balId, voieId),
    requireBalClient(balId).then((client) =>
      findVoieNumeros({ client, path: { voieId }, throwOnError: true }),
    ),
  ]);

  return (
    <>
      <BboxMapEffects bbox={voie.bbox} />
      <DetailHeader
        nom={voie.nom}
        nbNumeros={voie.nbNumeros}
        editHref={`${voieHref}/edit`}
        editLabel="Modifier la voie"
      />
      <NameList
        // Ordre de l'API conservé (numéro puis suffixe) : pas de tri par nom
        items={numeros.map((numero) => ({
          id: numero.id,
          nom: numero.numeroComplet,
        }))}
        label="Numéros de la voie"
        searchLabel="Rechercher un numéro"
        emptyMessage="Aucun numéro sur cette voie."
        hrefPrefix={`${voieHref}/numeros`}
        hrefSuffix="/edit"
        addHref={`${voieHref}/numeros/new`}
        addLabel="Ajouter un numéro"
        archive={{ balId, kind: "numero" }}
      />
    </>
  );
}
