import { NameListSkeleton } from "@/components/adresses/list/NameListSkeleton";
import { VoieHeaderSkeleton } from "@/components/adresses/voie/VoieHeaderSkeleton";

export default function Loading() {
  return (
    <>
      <VoieHeaderSkeleton />
      <NameListSkeleton searchLabel="Rechercher un numéro" />
    </>
  );
}
