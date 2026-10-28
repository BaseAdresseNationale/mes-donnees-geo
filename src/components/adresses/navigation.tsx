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

// Navigation au sein d'une BAL, suivie depuis le layout (monté d'une page à
// l'autre) :
// - retour des formulaires (bouton « Retour » des onglets, « Annuler ») :
//   vers la page de la BAL affichée juste avant (ex. le toponyme d'où l'on a
//   ouvert un numéro), suivie ici plutôt que via l'historique du navigateur ;
//   à défaut (accès direct à l'URL), vers une page de repli que le
//   formulaire peut fixer (ex. la voie d'un numéro, absente de l'URL) ;
// - mémoire des listes de voies et de toponymes (recherche, page, dernier
//   élément consulté) : en y revenant, on retrouve sa place.

export type ListMemoryKey = "voies" | "toponymes";

export interface ListMemory {
  query: string;
  page: number;
  // Dernier élément consulté, mis en évidence dans la liste
  selectedId: string | null;
}

const EMPTY_LIST_MEMORY: ListMemory = { query: "", page: 1, selectedId: null };

const NavigationContext = createContext<{
  previousPathRef: RefObject<string | null>;
  listMemoryRef: RefObject<Record<ListMemoryKey, ListMemory>>;
  fallbackHref: string | null;
  setFallbackHref: (href: string | null) => void;
}>({
  previousPathRef: { current: null },
  listMemoryRef: {
    current: { voies: EMPTY_LIST_MEMORY, toponymes: EMPTY_LIST_MEMORY },
  },
  fallbackHref: null,
  setFallbackHref: () => {},
});

// Page d'une voie ou d'un toponyme (et ses sous-pages, ex. …/voies/{id}/edit),
// hors formulaire de création
const DETAIL_PATH_REGEX = /\/(voies|toponymes)\/([^/]+)/;

export function NavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const currentPathRef = useRef<string | null>(null);
  const previousPathRef = useRef<string | null>(null);
  const listMemoryRef = useRef<Record<ListMemoryKey, ListMemory>>({
    voies: EMPTY_LIST_MEMORY,
    toponymes: EMPTY_LIST_MEMORY,
  });
  const [fallbackHref, setFallbackHref] = useState<string | null>(null);

  useEffect(() => {
    if (currentPathRef.current !== pathname) {
      previousPathRef.current = currentPathRef.current;
      currentPathRef.current = pathname;
    }

    const match = pathname.match(DETAIL_PATH_REGEX);
    if (match && match[2] !== "new") {
      const key = match[1] as ListMemoryKey;
      listMemoryRef.current[key] = {
        ...listMemoryRef.current[key],
        selectedId: match[2],
      };
    }
  }, [pathname]);

  return (
    <NavigationContext.Provider
      value={{ previousPathRef, listMemoryRef, fallbackHref, setFallbackHref }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

// Page de repli fixée par le formulaire affiché (null si aucune)
export function useFormBackFallback(): string | null {
  return useContext(NavigationContext).fallbackHref;
}

// Fixe la page de repli tant que le formulaire est affiché
export function useSetFormBackFallback(href: string) {
  const { setFallbackHref } = useContext(NavigationContext);
  useEffect(() => {
    setFallbackHref(href);
    return () => setFallbackHref(null);
  }, [href, setFallbackHref]);
}

// Retour à la page précédente de la BAL, ou à `fallbackHref` s'il n'y en a pas
export function useGoBack() {
  const router = useRouter();
  const { previousPathRef } = useContext(NavigationContext);
  return useCallback(
    (fallbackHref: string) => {
      router.push(previousPathRef.current ?? fallbackHref);
    },
    [router, previousPathRef],
  );
}

// Mémoire d'une liste : `get` à la lecture (montage de la liste), `save` à
// chaque changement de recherche ou de page. Sans clé, rien n'est mémorisé.
export function useListMemory(key: ListMemoryKey | undefined) {
  const { listMemoryRef } = useContext(NavigationContext);
  const get = useCallback(
    (): ListMemory => (key ? listMemoryRef.current[key] : EMPTY_LIST_MEMORY),
    [listMemoryRef, key],
  );
  const save = useCallback(
    (values: Pick<ListMemory, "query" | "page">) => {
      if (key) {
        listMemoryRef.current[key] = {
          ...listMemoryRef.current[key],
          ...values,
        };
      }
    },
    [listMemoryRef, key],
  );
  return { get, save };
}
