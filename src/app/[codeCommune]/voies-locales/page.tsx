import { requireSession } from "@/lib/auth/session";
import { LocalPathList } from "@/components/voies-locales/list/LocalPathsList";
import { LocalPathsOnboardingTour } from "@/components/voies-locales/list/LocalPathsOnboardingTour";
import { getLocalPaths } from "@/plugins/voies-locales";

export default async function LocalPathsListPage() {
  const session = await requireSession();
  const localPaths = await getLocalPaths(session.communeInsee);

  return (
    <>
      <LocalPathsOnboardingTour
        codeCommune={session.communeInsee}
        hasLocalPaths={localPaths.length > 0}
      />
      <LocalPathList
        codeCommune={session.communeInsee}
        localPaths={localPaths}
      />
    </>
  );
}
