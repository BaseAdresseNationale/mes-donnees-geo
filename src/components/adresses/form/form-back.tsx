"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { usePathname, useRouter } from "next/navigation";

// Retour des formulaires (bouton « Retour » des onglets, « Annuler ») :
// - vers la page de la BAL affichée juste avant (ex. le toponyme d'où l'on a
//   ouvert un numéro), suivie ici plutôt que via l'historique du navigateur ;
// - à défaut (accès direct à l'URL), vers une page de repli que le
//   formulaire peut fixer (ex. la voie d'un numéro, absente de l'URL).
const FormBackContext = createContext<{
  previousPathRef: RefObject<string | null>;
  fallbackHref: string | null;
  setFallbackHref: (href: string | null) => void;
}>({
  previousPathRef: { current: null },
  fallbackHref: null,
  setFallbackHref: () => {},
});

// Monté dans le layout de la BAL : il reste en place d'une page à l'autre et
// mémorise la page précédente.
export function FormBackProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const currentPathRef = useRef<string | null>(null);
  const previousPathRef = useRef<string | null>(null);
  const [fallbackHref, setFallbackHref] = useState<string | null>(null);

  useEffect(() => {
    if (currentPathRef.current !== pathname) {
      previousPathRef.current = currentPathRef.current;
      currentPathRef.current = pathname;
    }
  }, [pathname]);

  return (
    <FormBackContext.Provider
      value={{ previousPathRef, fallbackHref, setFallbackHref }}
    >
      {children}
    </FormBackContext.Provider>
  );
}

// Page de repli fixée par le formulaire affiché (null si aucune)
export function useFormBackFallback(): string | null {
  return useContext(FormBackContext).fallbackHref;
}

// Fixe la page de repli tant que le formulaire est affiché
export function useSetFormBackFallback(href: string) {
  const { setFallbackHref } = useContext(FormBackContext);
  useEffect(() => {
    setFallbackHref(href);
    return () => setFallbackHref(null);
  }, [href, setFallbackHref]);
}

// Retour à la page précédente de la BAL, ou à `fallbackHref` s'il n'y en a pas
export function useGoBack() {
  const router = useRouter();
  const { previousPathRef } = useContext(FormBackContext);
  return useCallback(
    (fallbackHref: string) => {
      router.push(previousPathRef.current ?? fallbackHref);
    },
    [router, previousPathRef],
  );
}
