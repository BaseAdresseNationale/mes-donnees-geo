import { requireSession } from "@/lib/auth/session";
import { LocalPathList } from "@/components/voies-locales/list/LocalPathsList";
import { LocalPathsOnboardingTour } from "@/components/voies-locales/list/LocalPathsOnboardingTour";
import { getLocalPaths } from "@/plugins/voies-locales";
import { getPublicationOverview } from "@/lib/db/publications";

export default async function LocalPathsListPage() {
  const session = await requireSession();
  const [localPaths, publication] = await Promise.all([
    getLocalPaths(session.communeInsee),
    getPublicationOverview(session.communeInsee),
  ]);

  return (
    <>
      <LocalPathsOnboardingTour
        codeCommune={session.communeInsee}
        hasLocalPaths={localPaths.length > 0}
      />
      <LocalPathList
        codeCommune={session.communeInsee}
        localPaths={localPaths}
        publication={publication}
      />
    </>
  );
}
