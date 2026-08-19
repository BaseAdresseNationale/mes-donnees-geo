"use client";

import { PANORAMAX_VIEWER_URL } from "@/components/map/layers/panoramax.layers";
import { PanoramaxViewer } from "@/components/panoramax/PanoramaxViewer";
import PanoramaxContext from "@/contexts/PanoramaxContext";
import { useCallback, useContext, useEffect } from "react";
import { useDOMRef } from "@/hooks/useDOMRef";
import MapContext from "@/contexts/MapContext";
import { createPortal } from "react-dom";
import { useParams, useRouter, useSearchParams } from "next/navigation";

const RESTORE_DURATION_MS = 700;

export default function PanoramaxViewerPage() {
  const router = useRouter();
  const { codeCommune } = useParams<{ codeCommune: string }>();
  const searchParams = useSearchParams();
  const pictureId = searchParams.get("pictureID");
  const { mapRef } = useContext(MapContext);
  const { savedView, setSavedView } = useContext(PanoramaxContext);
  const [mainElRef, setMainElRef] = useDOMRef<HTMLElement>();

  useEffect(() => {
    const el =
      typeof document !== "undefined"
        ? document.querySelector<HTMLElement>(".c__main-layout__content")
        : null;
    if (!el) return;
    const previous = el.style.position;
    el.style.position = "relative";
    return () => {
      el.style.position = previous;
    };
  }, []);

  const mainElPortal = useCallback(
    (children: React.ReactNode) => {
      if (!mainElRef) return null;

      return createPortal(children, mainElRef);
    },
    [mainElRef],
  );

  useEffect(() => {
    const el =
      typeof document !== "undefined"
        ? document.querySelector<HTMLElement>(".c__main-layout__content")
        : null;
    if (!el) return;

    const previous = el.style.position;
    el.style.position = "relative";
    setMainElRef(el);

    return () => {
      el.style.position = previous;
    };
  }, [setMainElRef]);

  const handleClose = useCallback(() => {
    const m = mapRef?.getMap();
    if (m && savedView) {
      m.easeTo({
        center: [savedView.center.lng, savedView.center.lat],
        zoom: savedView.zoom,
        pitch: savedView.pitch,
        bearing: savedView.bearing,
        duration: RESTORE_DURATION_MS,
        essential: true,
      });
    }
    setSavedView(null);
    router.back();
  }, [mapRef, savedView, setSavedView, router]);

  // Safety: if the user lands on this page directly (no pictureID), go home.
  useEffect(() => {
    if (!pictureId) {
      router.replace(`/${codeCommune}`);
    }
  }, [pictureId, codeCommune, router]);

  if (!pictureId) return null;

  if (!process.env.NEXT_PUBLIC_PANORAMAX_API_URL) return null;

  const src = `${PANORAMAX_VIEWER_URL}${encodeURIComponent(pictureId)}`;

  return mainElPortal
    ? mainElPortal(<PanoramaxViewer src={src} onClose={handleClose} />)
    : null;
}
