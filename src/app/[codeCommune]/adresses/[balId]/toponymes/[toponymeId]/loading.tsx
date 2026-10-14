import { NameListSkeleton } from "@/components/adresses/list/NameListSkeleton";
import { DetailHeaderSkeleton } from "@/components/adresses/detail/DetailHeaderSkeleton";

export default function Loading() {
  return (
    <>
      <DetailHeaderSkeleton />
      <NameListSkeleton />
    </>
  );
}
