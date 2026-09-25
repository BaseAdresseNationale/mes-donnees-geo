import {
  LocalPathBornage,
  LocalPathClassement,
  LocalPathEtat,
  LocalPathGestionnaire,
  LocalPathRevetement,
  LocalPathServitude,
  LocalPathStatus,
  LocalPathType,
} from "@/generated/prisma/browser";

export interface LocalPathSegmentInput {
  path: GeoJSON.LineString;
  type: LocalPathType;
  revetement: LocalPathRevetement;
  largeurMoyenne: number | null;
  etat: LocalPathEtat;
  fermeALaCirculation: boolean | null;
  servitudes: LocalPathServitude[];
  bornage: LocalPathBornage | null;
}

export interface LocalPathInput {
  nom: string | null;
  statut: LocalPathStatus;
  classement: LocalPathClassement;
  numero: number;
  gestionnaire: LocalPathGestionnaire | null;
  commentaire: string | null;
  segments: LocalPathSegmentInput[];
}

export type ValidationResult =
  | { ok: true; data: LocalPathInput }
  | { ok: false; error: string };

type SegmentValidationResult =
  | { ok: true; data: LocalPathSegmentInput }
  | { ok: false; error: string };

const STATUT_VALUES = new Set<string>(Object.values(LocalPathStatus));
const CLASSEMENT_VALUES = new Set<string>(Object.values(LocalPathClassement));
const TYPE_VALUES = new Set<string>(Object.values(LocalPathType));
const REVETEMENT_VALUES = new Set<string>(Object.values(LocalPathRevetement));
const ETAT_VALUES = new Set<string>(Object.values(LocalPathEtat));
const SERVITUDE_VALUES = new Set<string>(Object.values(LocalPathServitude));
const BORNAGE_VALUES = new Set<string>(Object.values(LocalPathBornage));
const GESTIONNAIRE_VALUES = new Set<string>(
  Object.values(LocalPathGestionnaire),
);

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

  let type: LocalPathType = LocalPathType.TRONCON;
  if (s.type !== undefined && s.type !== null) {
    if (typeof s.type !== "string" || !TYPE_VALUES.has(s.type)) {
      return { ok: false, error: `Segment ${index + 1} : type invalide.` };
    }
    type = s.type as LocalPathType;
  }

  if (typeof s.revetement !== "string" || !REVETEMENT_VALUES.has(s.revetement)) {
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

  let etat: LocalPathEtat = LocalPathEtat.BON;
  if (s.etat !== undefined && s.etat !== null) {
    if (typeof s.etat !== "string" || !ETAT_VALUES.has(s.etat)) {
      return { ok: false, error: `Segment ${index + 1} : état invalide.` };
    }
    etat = s.etat as LocalPathEtat;
  }

  let fermeALaCirculation: boolean | null = null;
  if (s.fermeALaCirculation !== undefined && s.fermeALaCirculation !== null) {
    if (typeof s.fermeALaCirculation !== "boolean") {
      return {
        ok: false,
        error: `Segment ${index + 1} : fermeture à la circulation invalide.`,
      };
    }
    fermeALaCirculation = s.fermeALaCirculation;
  }

  const servitudes: LocalPathServitude[] = [];
  if (s.servitudes !== undefined && s.servitudes !== null) {
    if (!Array.isArray(s.servitudes)) {
      return {
        ok: false,
        error: `Segment ${index + 1} : servitudes invalides.`,
      };
    }
    for (const v of s.servitudes) {
      if (typeof v !== "string" || !SERVITUDE_VALUES.has(v)) {
        return {
          ok: false,
          error: `Segment ${index + 1} : servitude invalide.`,
        };
      }
      servitudes.push(v as LocalPathServitude);
    }
  }

  let bornage: LocalPathBornage | null = null;
  if (s.bornage !== undefined && s.bornage !== null) {
    if (typeof s.bornage !== "string" || !BORNAGE_VALUES.has(s.bornage)) {
      return { ok: false, error: `Segment ${index + 1} : bornage invalide.` };
    }
    bornage = s.bornage as LocalPathBornage;
  }

  return {
    ok: true,
    data: {
      path: s.path as GeoJSON.LineString,
      type,
      revetement: s.revetement as LocalPathRevetement,
      largeurMoyenne,
      etat,
      fermeALaCirculation,
      servitudes,
      bornage,
    },
  };
}

export function validateLocalPathInput(body: unknown): ValidationResult {
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
  const statutRaw = b.statut ?? LocalPathStatus.DRAFT;
  if (typeof statutRaw !== "string" || !STATUT_VALUES.has(statutRaw)) {
    return { ok: false, error: "statut invalide." };
  }
  const statut = statutRaw as LocalPathStatus;

  // classement
  if (
    typeof b.classement !== "string" ||
    !CLASSEMENT_VALUES.has(b.classement)
  ) {
    return { ok: false, error: "classement invalide ou manquant." };
  }
  const classement = b.classement as LocalPathClassement;

  // numero
  if (
    typeof b.numero !== "number" ||
    !Number.isInteger(b.numero) ||
    b.numero < 0
  ) {
    return { ok: false, error: "numero invalide ou manquant." };
  }
  const numero = b.numero;

  // gestionnaire
  let gestionnaire: LocalPathGestionnaire | null = null;
  if (b.gestionnaire !== undefined && b.gestionnaire !== null) {
    if (
      typeof b.gestionnaire !== "string" ||
      !GESTIONNAIRE_VALUES.has(b.gestionnaire)
    ) {
      return { ok: false, error: "gestionnaire invalide." };
    }
    gestionnaire = b.gestionnaire as LocalPathGestionnaire;
  }

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
  const segments: LocalPathSegmentInput[] = [];
  for (let i = 0; i < segmentsRaw.length; i++) {
    const result = validateSegment(segmentsRaw[i], i);
    if (!result.ok) return result;
    segments.push(result.data);
  }

  return {
    ok: true,
    data: { nom, statut, classement, numero, gestionnaire, commentaire, segments },
  };
}
