import Map, { Layer, NavigationControl, Source } from "react-map-gl/maplibre";
import { useCallback, useContext, useMemo, useState } from "react";
import { CadastreContext } from "../contexts/CadastreContext";
import { AppLayout, AppLayoutProps } from "./AppLayout";
import styles from "./MapLayout.module.css";
import { PanoramaxToggle } from "@/components/map/Panoramax/PanoramaxToggle";
import { PanoramaxMap } from "@/components/map/Panoramax/PanoramaxMap";
import { PanoramaxLensDrag } from "@/components/map/Panoramax/PanoramaxLensDrag";
import { StylesSwitch } from "@/components/map/controls/StylesSwitch";
import { mapStyles } from "@/components/map/styles";
import MapContext, { AvailableDataLayer } from "@/contexts/MapContext";
import { useLocalStorageContext } from "@/contexts/LocalStorageContext";
import {
  parcelleHoveredLayer,
  staticCadastreLayers,
} from "@/components/map/cadastre/cadastre.layers";
import { PANORAMAX_SEQUENCE_LAYER_ID } from "@/components/map/Panoramax/panoramax.layers";
import { useCommune } from "@/contexts/CommuneContext";
import { buildInvertedMask } from "@/lib/geo/mask";
import {
  COMMUNE_MASK_SOURCE,
  COMMUNE_SOURCE,
  communeMaskLayer,
  communeOutlineCasingLayer,
  communeOutlineLayer,
} from "@/components/map/layers/commune.layers";
import { CadastreControl } from "@/components/map/cadastre/CadastreControl";
import { ControlGroupPortal } from "@/components/map/controls/ControlGroupPortal";
import { BANMap } from "@/components/map/ban/BANMap";
import { BANLayers } from "@/components/map/ban/ban.layers";

type MapLayoutProps = {
  toolbarChildren?: React.ReactNode;
} & AppLayoutProps;

export function MapLayout({
  children,
  toolbarChildren,
  ...props
}: MapLayoutProps) {
  const [cursor, setCursor] = useState<string | null>(null);
  const onMouseEnter = useCallback(() => setCursor("pointer"), []);
  const onMouseLeave = useCallback(() => setCursor(null), []);

  const {
    mapRefCb,
    mapChildren,
    mapMessage,
    mapToolChildren,
    activeDataLayers,
  } = useContext(MapContext);
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

  return (
    <AppLayout {...props}>
      <main className={styles.mapWrapper}>
        <div
          className={`${styles.toolbar} ${toolbarChildren ? styles.toolbarOpen : ""}`}
          role="toolbar"
          aria-label="Outils d'édition"
        >
          {toolbarChildren}
          {mapMessage && (
            <div className={styles.mapMessage} role="status">
              {mapMessage}
            </div>
          )}
        </div>
        <Map
          ref={mapRefCb}
          mapStyle={currentMapStyle.uri}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          interactiveLayerIds={[
            parcelleHoveredLayer.id,
            PANORAMAX_SEQUENCE_LAYER_ID,
            ...(BANLayers.filter((layer) => layer.interactive).map(
              ({ layer }) => layer.id,
            ) || []),
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
            <Layer {...(communeOutlineCasingLayer as any)} />
            <Layer {...(communeOutlineLayer as any)} />
          </Source>
          <PanoramaxMap />

          {activeDataLayers.includes(AvailableDataLayer.BAN) && <BANMap />}

          {mapChildren}

          <PanoramaxLensDrag />
          <NavigationControl position="bottom-right" />
          <ControlGroupPortal position="bottom-left">
            <StylesSwitch styles={mapStyles} />
            {mapToolChildren}
            <PanoramaxToggle />
            <CadastreControl
              showCadastre={showCadastre}
              setShowCadastre={setShowCadastre}
            />
          </ControlGroupPortal>
        </Map>
      </main>
    </AppLayout>
  );
}
