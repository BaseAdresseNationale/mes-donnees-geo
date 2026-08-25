import { useCallback, useContext } from "react";
import style from "./CadastreSearch.module.css";
import { LngLatBoundsLike } from "react-map-gl/maplibre";
import bbox from "@turf/bbox";
import { AllGeoJSON } from "@turf/helpers";
import AutocompleteInput, {
  SearchItemType,
} from "@/components/common/autocomplete";
import { ParcelleFeature, useCadastreSearch } from "@/contexts/CadastreContext";
import MapContext from "@/contexts/MapContext";

interface CadastreSearchProps {
  visible?: boolean;
}

function CadastreSearch({ visible }: CadastreSearchProps) {
  const { mapRef } = useContext(MapContext);
  const { handleSearchParcelle } = useCadastreSearch();

  const handleSelectParcelle = useCallback(
    (parcelle?: SearchItemType<ParcelleFeature> | null) => {
      if (!mapRef || !parcelle || !parcelle.geometry) {
        return;
      }

      const parcelleBbox = bbox(parcelle.geometry as AllGeoJSON);
      const center = [
        (parcelleBbox[0] + parcelleBbox[2]) / 2,
        (parcelleBbox[1] + parcelleBbox[3]) / 2,
      ] as [number, number];
      const camera = mapRef.cameraForBounds(parcelleBbox as LngLatBoundsLike, {
        padding: 100,
      });
      mapRef.flyTo({
        center,
        offset: [0, 0],
        zoom: camera?.zoom,
        screenSpeed: 2,
      });
    },
    [mapRef],
  );

  return (
    <div
      className={
        style.cadastreSearch + " " + (visible ? style.visible : style.hidden)
      }
    >
      <AutocompleteInput
        label="Rechercher une parcelle cadastrale"
        key={String(visible)}
        onSearch={handleSearchParcelle}
        onSelect={handleSelectParcelle}
        noResultsMessage="Aucune parcelle ne correspond à votre recherche"
        resultsListPosition="top"
        itemToString={(parcelle) => (parcelle ? parcelle.id : "")}
        inputProps={{
          hideLabel: true,
          fullWidth: true,
        }}
      />
    </div>
  );
}

export default CadastreSearch;
