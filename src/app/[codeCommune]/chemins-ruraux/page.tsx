import { requireSession } from "@/lib/auth/session";
import { RuralPathList } from "@/components/chemins-ruraux/list/RuralPathsList";
import { RuralPathsOnboardingTour } from "@/components/chemins-ruraux/list/RuralPathsOnboardingTour";
import { getRuralPaths } from "@/plugins/chemins-ruraux";

export default async function RuralPathsListPage() {
  const session = await requireSession();
  const ruralPaths = await getRuralPaths(session.communeInsee);

  return (
    <>
      <RuralPathsOnboardingTour
        codeCommune={session.communeInsee}
        hasRuralPaths={ruralPaths.length > 0}
      />
      <RuralPathList
        codeCommune={session.communeInsee}
        ruralPaths={ruralPaths}
      />
    </>
  );
}
