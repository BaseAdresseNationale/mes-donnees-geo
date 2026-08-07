import { redirect } from "next/navigation";
import { getEnabledPlugins } from "@/plugins/registry";

export default async function CommuneIndex({
  params,
}: {
  params: Promise<{ codeCommune: string }>;
}) {
  const { codeCommune } = await params;
  const enabledPlugins = await getEnabledPlugins(codeCommune);
  const firstEnabled = enabledPlugins[0];
  if (!firstEnabled) {
    return (
      <div style={{ padding: "2rem" }}>
        <h1>Aucun plugin activé</h1>
        <p>
          Contactez votre administrateur pour activer au moins un type de
          données.
        </p>
      </div>
    );
  }
  redirect(`/${codeCommune}/${firstEnabled.id}`);
}
