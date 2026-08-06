import { redirect } from "next/navigation";
import { listAllPlugins } from "@/plugins/registry";

export default async function CommuneIndex({
  params,
}: {
  params: Promise<{ codeCommune: string }>;
}) {
  const { codeCommune } = await params;
  const first = listAllPlugins()[0];
  if (!first) {
    return (
      <div style={{ padding: "2rem" }}>
        <h1>Aucun plugin activé</h1>
        <p>Contactez votre administrateur pour activer au moins un type de données.</p>
      </div>
    );
  }
  redirect(`/${codeCommune}/${first.id}`);
}
