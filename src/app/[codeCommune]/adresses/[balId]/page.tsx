import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getCommuneBalsForClient } from "@/lib/api-bal/bal-access";

// Identifiant de BAL au format ObjectId (24 caractères hexadécimaux)
const BAL_ID_RE = /^[0-9a-f]{24}$/i;

export default async function BalPage({
  params,
}: {
  params: Promise<{ codeCommune: string; balId: string }>;
}) {
  const { balId } = await params;
  if (!BAL_ID_RE.test(balId)) notFound();

  return <div>{balId}</div>;
}
