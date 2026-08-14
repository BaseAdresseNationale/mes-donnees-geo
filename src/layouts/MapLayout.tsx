import Map, { Layer, NavigationControl, Source } from "react-map-gl/maplibre";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CadastreContext } from "../contexts/CadastreContext";
import { AppLayout, AppLayoutProps } from "./AppLayout";
import styles from "./MapLayout.module.css";
import { PanoramaxToggle } from "@/components/map/Panoramax/PanoramaxToggle";
import { PanoramaxMap } from "@/components/map/Panoramax/PanoramaxMap";
import { PanoramaxLensDrag } from "@/components/map/Panoramax/PanoramaxLensDrag";
import { StylesSwitch } from "@/components/map/controls/StylesSwitch";
import { mapStyles } from "@/components/map/styles";
import MapContext from "@/contexts/MapContext";
import { useLocalStorageContext } from "@/contexts/LocalStorageContext";
import {
  parcelleHoveredLayer,
  staticCadastreLayers,
} from "@/components/map/layers/cadastre.layers";
import { PANORAMAX_SEQUENCE_LAYER_ID } from "@/components/map/layers/panoramax.layers";
import { useCommune } from "@/contexts/CommuneContext";
import { geometryBounds } from "@/lib/geo/bounds";
import { buildInvertedMask } from "@/lib/geo/mask";
import {
  COMMUNE_MASK_SOURCE,
  COMMUNE_SOURCE,
  communeMaskLayer,
  communeOutlineLayer,
} from "@/components/map/layers/commune.layers";
import { CadastreControl } from "@/components/map/controls/cadastre/CadastreControl";
import { ControlGroupPortal } from "@/components/map/controls/ControlGroupPortal";

type MapLayoutProps = {
  mapChildren?: React.ReactNode;
  toolbarChildren?: React.ReactNode;
} & AppLayoutProps;

export function MapLayout({
  children,
  mapChildren,
  toolbarChildren,
  ...props
}: MapLayoutProps) {
  const [cursor, setCursor] = useState<string | null>(null);
  const onMouseEnter = useCallback(() => setCursor("pointer"), []);
  const onMouseLeave = useCallback(() => setCursor(null), []);

  const { mapRefCb, mapRef } = useContext(MapContext);
  const { showCadastre, setShowCadastre } = useContext(CadastreContext);
  const { contour: communeContour } = useCommune();
  const { basemapId } = useLocalStorageContext();

  const currentMapStyle = useMemo(
    () => mapStyles.find((style) => style.id === basemapId) ?? mapStyles[0],
    [basemapId],
  );

  const communeMask = useMemo(
    () => (communeContour ? buildInvertedMask(communeContour.geometry) : null),
    [communeContour],
  );

  const initialFitDoneRef = useRef(false);
  useEffect(() => {
    if (!mapRef || !communeContour) return;
    if (!initialFitDoneRef.current) {
      const bounds = geometryBounds(communeContour.geometry);
      if (bounds) {
        mapRef.fitBounds(bounds, { padding: 40, duration: 0, maxZoom: 16 });
        initialFitDoneRef.current = true;
      }
    }
  }, [communeContour, mapRef]);

  return (
    <AppLayout {...props}>
      <div className={styles.mapWrapper}>
        {toolbarChildren && (
          <div
            className={styles.toolbar}
            role="toolbar"
            aria-label="Outils d'édition"
          >
            {toolbarChildren}
          </div>
        )}
        <Map
          ref={mapRefCb}
          mapStyle={currentMapStyle.uri}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          interactiveLayerIds={[
            parcelleHoveredLayer.id,
            PANORAMAX_SEQUENCE_LAYER_ID,
          ]}
          {...(cursor ? { cursor } : {})}
        >
          <Source
            id="cadastre"
            type="vector"
            url="https://openmaptiles.geo.data.gouv.fr/data/cadastre.json"
          >
            {staticCadastreLayers.map((cadastreLayer) => {
              return (
                <Layer
                  key={cadastreLayer.id}
                  {...(cadastreLayer as any)}
                  layout={{
                    ...cadastreLayer.layout,
                    visibility: showCadastre ? "visible" : "none",
                  }}
                />
              );
            })}
          </Source>
          <Source
            id={COMMUNE_MASK_SOURCE}
            type="geojson"
            data={{
              type: "FeatureCollection",
              features: communeMask ? [communeMask] : [],
            }}
          >
            <Layer {...(communeMaskLayer as any)} />
          </Source>
          <Source
            id={COMMUNE_SOURCE}
            type="geojson"
            data={{
              type: "FeatureCollection",
              features: communeContour ? [communeContour] : [],
            }}
          >
            <Layer {...(communeOutlineLayer as any)} />
          </Source>
          <PanoramaxMap />

          {mapChildren}

          <PanoramaxLensDrag />
          <NavigationControl position="top-right" />

          <ControlGroupPortal position="bottom-left">
            <StylesSwitch styles={mapStyles} />
            <PanoramaxToggle />
            <CadastreControl
              showCadastre={showCadastre}
              setShowCadastre={setShowCadastre}
            />
          </ControlGroupPortal>
        </Map>
      </div>
    </AppLayout>
  );
}
