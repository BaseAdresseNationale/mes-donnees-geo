import { RuralPathStatus, RuralPathSurface } from "./types";

export interface RuralPathInput {
  nom: string | null;
  statut: RuralPathStatus;
  path: GeoJSON.MultiLineString | null;
  surfaces: RuralPathSurface[];
}

export type ValidationResult =
  | { ok: true; data: RuralPathInput }
  | { ok: false; error: string };

const STATUT_VALUES = new Set<string>(Object.values(RuralPathStatus));
const SURFACE_VALUES = new Set<string>(Object.values(RuralPathSurface));

const NAME_MAX_LENGTH = 200;

function isLngLat(v: unknown): v is [number, number] {
  return (
    Array.isArray(v) &&
    v.length >= 2 &&
    typeof v[0] === "number" &&
    typeof v[1] === "number" &&
    Number.isFinite(v[0]) &&
    Number.isFinite(v[1]) &&
    v[0] >= -180 &&
    v[0] <= 180 &&
    v[1] >= -90 &&
    v[1] <= 90
  );
}

function isMultiLineString(v: unknown): v is GeoJSON.MultiLineString {
  if (!v || typeof v !== "object") return false;
  const g = v as { type?: unknown; coordinates?: unknown };
  if (g.type !== "MultiLineString") return false;
  if (!Array.isArray(g.coordinates)) return false;
  return g.coordinates.every(
    (line) => Array.isArray(line) && line.length >= 2 && line.every(isLngLat),
  );
}

export function validateRuralPathInput(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Corps de requête invalide." };
  }
  const b = body as Record<string, unknown>;

  // nom
  let nom: string | null = null;
  if (b.nom !== undefined && b.nom !== null) {
    if (typeof b.nom !== "string") return { ok: false, error: "nom invalide." };
    const trimmed = b.nom.trim();
    if (trimmed.length > NAME_MAX_LENGTH) {
      return {
        ok: false,
        error: `nom trop long (${NAME_MAX_LENGTH} caractères max).`,
      };
    }
    nom = trimmed.length > 0 ? trimmed : null;
  }

  // statut
  const statutRaw = b.statut ?? RuralPathStatus.DRAFT;
  if (typeof statutRaw !== "string" || !STATUT_VALUES.has(statutRaw)) {
    return { ok: false, error: "statut invalide." };
  }
  const statut = statutRaw as RuralPathStatus;

  // path
  let path: GeoJSON.MultiLineString | null = null;
  if (b.path !== undefined && b.path !== null) {
    if (!isMultiLineString(b.path)) {
      return {
        ok: false,
        error: "path doit être un GeoJSON MultiLineString (coordonnées WGS84).",
      };
    }
    path = b.path;
  }

  // surfaces
  const surfacesRaw = b.surfaces ?? [];
  if (!Array.isArray(surfacesRaw)) {
    return { ok: false, error: "surfaces doit être un tableau." };
  }
  if (
    !surfacesRaw.every(
      (s): s is string => typeof s === "string" && SURFACE_VALUES.has(s),
    )
  ) {
    return { ok: false, error: "surfaces contient une valeur inconnue." };
  }
  const surfaces = surfacesRaw as RuralPathSurface[];

  if (path !== null && path.coordinates.length !== surfaces.length) {
    return {
      ok: false,
      error:
        "Le nombre de revêtements doit égaler le nombre de segments du chemin.",
    };
  }
  if (path === null && surfaces.length > 0) {
    return {
      ok: false,
      error: "surfaces doit être vide quand path est absent.",
    };
  }

  return { ok: true, data: { nom, statut, path, surfaces } };
}
