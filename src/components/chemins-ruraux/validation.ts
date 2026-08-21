import {
  RuralPathClassement,
  RuralPathDomanialite,
  RuralPathEtat,
  RuralPathStatus,
  RuralPathSurface,
} from "@/generated/prisma/browser";

export interface RuralPathSegmentInput {
  path: GeoJSON.LineString;
  surface: RuralPathSurface;
  largeurMoyenne: number | null;
  etatEntretien: RuralPathEtat | null;
  etatConservation: RuralPathEtat | null;
  domanialite: RuralPathDomanialite | null;
}

export interface RuralPathInput {
  nom: string | null;
  statut: RuralPathStatus;
  classement: RuralPathClassement;
  numero: number;
  commentaire: string | null;
  segments: RuralPathSegmentInput[];
}

export type ValidationResult =
  | { ok: true; data: RuralPathInput }
  | { ok: false; error: string };

type SegmentValidationResult =
  | { ok: true; data: RuralPathSegmentInput }
  | { ok: false; error: string };

const STATUT_VALUES = new Set<string>(Object.values(RuralPathStatus));
const CLASSEMENT_VALUES = new Set<string>(Object.values(RuralPathClassement));
const SURFACE_VALUES = new Set<string>(Object.values(RuralPathSurface));
const ETAT_VALUES = new Set<string>(Object.values(RuralPathEtat));
const DOMANIALITE_VALUES = new Set<string>(Object.values(RuralPathDomanialite));

const NAME_MAX_LENGTH = 200;
const COMMENTAIRE_MAX_LENGTH = 2000;

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

function isLineString(v: unknown): v is GeoJSON.LineString {
  if (!v || typeof v !== "object") return false;
  const g = v as { type?: unknown; coordinates?: unknown };
  if (g.type !== "LineString") return false;
  if (!Array.isArray(g.coordinates) || g.coordinates.length < 2) return false;
  return g.coordinates.every(isLngLat);
}

function validateSegment(raw: unknown, index: number): SegmentValidationResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: `Segment ${index + 1} invalide.` };
  }
  const s = raw as Record<string, unknown>;

  if (!isLineString(s.path)) {
    return {
      ok: false,
      error: `Segment ${index + 1} : le tracé doit être un GeoJSON LineString (coordonnées WGS84).`,
    };
  }

  if (typeof s.surface !== "string" || !SURFACE_VALUES.has(s.surface)) {
    return { ok: false, error: `Segment ${index + 1} : revêtement invalide.` };
  }

  let largeurMoyenne: number | null = null;
  if (s.largeurMoyenne !== undefined && s.largeurMoyenne !== null) {
    if (
      typeof s.largeurMoyenne !== "number" ||
      !Number.isInteger(s.largeurMoyenne) ||
      s.largeurMoyenne < 0
    ) {
      return {
        ok: false,
        error: `Segment ${index + 1} : largeur moyenne invalide.`,
      };
    }
    largeurMoyenne = s.largeurMoyenne;
  }

  let etatEntretien: RuralPathEtat | null = null;
  if (s.etatEntretien !== undefined && s.etatEntretien !== null) {
    if (
      typeof s.etatEntretien !== "string" ||
      !ETAT_VALUES.has(s.etatEntretien)
    ) {
      return {
        ok: false,
        error: `Segment ${index + 1} : état d'entretien invalide.`,
      };
    }
    etatEntretien = s.etatEntretien as RuralPathEtat;
  }

  let etatConservation: RuralPathEtat | null = null;
  if (s.etatConservation !== undefined && s.etatConservation !== null) {
    if (
      typeof s.etatConservation !== "string" ||
      !ETAT_VALUES.has(s.etatConservation)
    ) {
      return {
        ok: false,
        error: `Segment ${index + 1} : état de conservation invalide.`,
      };
    }
    etatConservation = s.etatConservation as RuralPathEtat;
  }

  let domanialite: RuralPathDomanialite | null = null;
  if (s.domanialite !== undefined && s.domanialite !== null) {
    if (
      typeof s.domanialite !== "string" ||
      !DOMANIALITE_VALUES.has(s.domanialite)
    ) {
      return {
        ok: false,
        error: `Segment ${index + 1} : domanialité invalide.`,
      };
    }
    domanialite = s.domanialite as RuralPathDomanialite;
  }

  return {
    ok: true,
    data: {
      path: s.path as GeoJSON.LineString,
      surface: s.surface as RuralPathSurface,
      largeurMoyenne,
      etatEntretien,
      etatConservation,
      domanialite,
    },
  };
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

  // classement
  if (
    typeof b.classement !== "string" ||
    !CLASSEMENT_VALUES.has(b.classement)
  ) {
    return { ok: false, error: "classement invalide ou manquant." };
  }
  const classement = b.classement as RuralPathClassement;

  // numero
  if (
    typeof b.numero !== "number" ||
    !Number.isInteger(b.numero) ||
    b.numero < 0
  ) {
    return { ok: false, error: "numero invalide ou manquant." };
  }
  const numero = b.numero;

  // commentaire
  let commentaire: string | null = null;
  if (b.commentaire !== undefined && b.commentaire !== null) {
    if (typeof b.commentaire !== "string") {
      return { ok: false, error: "commentaire invalide." };
    }
    const trimmed = b.commentaire.trim();
    if (trimmed.length > COMMENTAIRE_MAX_LENGTH) {
      return {
        ok: false,
        error: `commentaire trop long (${COMMENTAIRE_MAX_LENGTH} caractères max).`,
      };
    }
    commentaire = trimmed.length > 0 ? trimmed : null;
  }

  // segments
  const segmentsRaw = b.segments ?? [];
  if (!Array.isArray(segmentsRaw)) {
    return { ok: false, error: "segments doit être un tableau." };
  }
  const segments: RuralPathSegmentInput[] = [];
  for (let i = 0; i < segmentsRaw.length; i++) {
    const result = validateSegment(segmentsRaw[i], i);
    if (!result.ok) return result;
    segments.push(result.data);
  }

  return {
    ok: true,
    data: { nom, statut, classement, numero, commentaire, segments },
  };
}
