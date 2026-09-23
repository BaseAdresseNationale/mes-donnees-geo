"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  OnboardingModal,
  OnboardingStep,
} from "@gouvfr-lasuite/ui-components";

const RURAL_PATHS_TOUR_STORAGE_KEY = "mdg:productTour:cheminsRuraux";

interface RuralPathsOnboardingTourProps {
  codeCommune: string;
  hasRuralPaths: boolean;
}

export function RuralPathsOnboardingTour({
  codeCommune,
  hasRuralPaths,
}: RuralPathsOnboardingTourProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (hasRuralPaths) return;
    // Lecture différée au montage : le localStorage n'existe pas côté serveur.
    const alreadySeen = window.localStorage.getItem(
      RURAL_PATHS_TOUR_STORAGE_KEY,
    );
    if (!alreadySeen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsOpen(true);
    }
  }, [hasRuralPaths]);

  const dismiss = () => {
    window.localStorage.setItem(RURAL_PATHS_TOUR_STORAGE_KEY, "1");
    setIsOpen(false);
  };

  const goToImport = () => {
    dismiss();
    router.push(`/${codeCommune}/chemins-ruraux/import/bd-topo`);
  };

  const steps: OnboardingStep[] = [
    {
      icon: <span className="material-icons">map</span>,
      title: "Recensez les chemins ruraux de votre commune",
      description:
        "Ce module vous permet de recenser, cartographier et exporter les chemins ruraux de votre commune.",
    },
    {
      icon: <span className="material-icons">cloud_download</span>,
      title: "Commencez par importer les chemins ruraux existants",
      description: (
        <>
          <p>
            Gagnez du temps : importez automatiquement les tronçons candidats
            depuis la base de données de l&apos;IGN, puis complétez les
            informations manquantes.
          </p>
          <Button color="brand" size="small" onClick={goToImport}>
            Importer les chemins
          </Button>
        </>
      ),
    },
    {
      icon: <span className="material-icons">edit</span>,
      title: "Dessinez les chemins manquants sur la carte",
      description:
        "Complétez l'import en traçant directement sur la carte les chemins ruraux qui n'existent pas encore dans les données de l'IGN.",
    },
    {
      icon: <span className="material-icons">publish</span>,
      title: "Publiez les chemins dès que vous êtes prêt",
      description:
        "Une fois les informations vérifiées, publiez vos chemins ruraux pour les rendre officiels.",
    },
  ];

  return (
    <OnboardingModal
      isOpen={isOpen}
      appName="Mes Adresses"
      mainTitle="Bienvenue dans le module Chemins ruraux"
      steps={steps}
      onSkip={dismiss}
      onComplete={dismiss}
      onClose={dismiss}
      labels={{
        skip: "Passer",
        next: "Suivant",
        previous: "Précédent",
        complete: "Terminer",
      }}
    />
  );
}
