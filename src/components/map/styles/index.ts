import type { MaplibreStyleDefinition } from "@/types/maplibre.types";

export const mapStyles: MaplibreStyleDefinition[] = [
  {
    id: "Bright",
    title: "Plan OSM",
    uri: "/map-styles/osm-bright.json",
    previewImage: "/images/preview-plan-osm.png",
  },
  {
    id: "Ortho",
    title: "Satellite",
    uri: "/map-styles/ortho.json",
    previewImage: "/images/preview-satellite.png",
  },
  {
    id: "Plan IGN",
    title: "Plan IGN",
    uri: "/map-styles/plan-ign.json",
    previewImage: "/images/preview-plan-ign.png",
  },
  {
    id: "MNT Lidar HD",
    title: "MNT Lidar HD",
    uri: "/map-styles/mnt-lidar-hd.json",
    previewImage: "/images/preview-mnt-lidar-hd.png",
  },
];
