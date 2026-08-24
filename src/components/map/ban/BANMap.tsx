import { useContext, useEffect, useRef, useState } from "react";
import DrawContext from "@/contexts/DrawContext";
import {
  Layer,
  MapLayerMouseEvent,
  Popup,
  Source,
} from "react-map-gl/maplibre";
import { adresseCircleLayer, BANLayers } from "./ban.layers";
import MapContext from "@/contexts/MapContext";
import styles from "./BANMap.module.css";
import {
  BANAddressProperties,
  getAddressLabelFromFeature,
} from "@/lib/ban/utils";
import { useCommune } from "@/contexts/CommuneContext";

export function BANMap() {
  const { mapRef } = useContext(MapContext);
  const { isDrawing } = useContext(DrawContext);
  const { contour } = useCommune();

  const [selectedAddress, setSelectedAddress] = useState<{
    properties: BANAddressProperties;
    lngLat: [number, number];
  } | null>(null);

  const hoveredStateId = useRef<{
    id: string;
    source: string;
    sourceLayer: string;
  } | null>(null);

  // Add select handlers to BAN layers
  useEffect(() => {
    if (!mapRef || isDrawing) {
      return;
    }

    const handleMouseMove = (e: MapLayerMouseEvent) => {
      if (!mapRef || !e.features) {
        return;
      }

      if (e.features.length > 0) {
        if (hoveredStateId.current) {
          mapRef.setFeatureState(
            {
              ...hoveredStateId.current,
            },
            { hover: false },
          );
        }
        const currentFeature = e.features[0];
        hoveredStateId.current = {
          id: currentFeature.id as string,
          source: currentFeature.source as string,
          sourceLayer: currentFeature.sourceLayer as string,
        };
        mapRef.setFeatureState(
          {
            ...hoveredStateId.current,
          },
          { hover: true },
        );

        if (currentFeature.sourceLayer === adresseCircleLayer["source-layer"]) {
          setSelectedAddress({
            properties: currentFeature.properties as BANAddressProperties,
            lngLat: [e.lngLat.lng, e.lngLat.lat],
          });
        }
      }
    };

    const handleMouseLeave = () => {
      if (hoveredStateId.current && mapRef) {
        mapRef.setFeatureState(
          {
            ...hoveredStateId.current,
          },
          { hover: false },
        );
        hoveredStateId.current = null;
      }
      setSelectedAddress(null);
    };

    BANLayers.forEach(({ layer }) => {
      if (mapRef) {
        mapRef.on("mousemove", layer.id, handleMouseMove);
        mapRef.on("mouseleave", layer.id, handleMouseLeave);
      }
    });

    return () => {
      BANLayers.forEach(({ layer }) => {
        if (mapRef) {
          mapRef.off("mousemove", layer.id, handleMouseMove);
          mapRef.off("mouseleave", layer.id, handleMouseLeave);
        }
      });
    };
  }, [mapRef, isDrawing]);

  return (
    <>
      {selectedAddress && (
        <Popup
          longitude={selectedAddress.lngLat[0]}
          latitude={selectedAddress.lngLat[1]}
          closeButton={false}
          closeOnClick={false}
          anchor="bottom"
          offset={14}
          className={styles.popup}
        >
          <div className={styles.popupTitle}>
            {getAddressLabelFromFeature(selectedAddress.properties)}
          </div>
        </Popup>
      )}
      <Source
        id="base-adresse-nationale"
        type="vector"
        tiles={[
          `${process.env.NEXT_PUBLIC_BAN_API_URL}/tiles/ban/{z}/{x}/{y}.pbf`,
        ]}
        minzoom={10}
        maxzoom={14}
        promoteId="id"
      >
        {BANLayers.map(({ layer }) => (
          <Layer key={layer.id} {...layer} filter={["within", contour]} />
        ))}
      </Source>
    </>
  );
}
