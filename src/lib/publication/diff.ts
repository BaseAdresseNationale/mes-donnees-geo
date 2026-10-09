import "server-only";
import { createHash } from "node:crypto";
import {
  CLASSEMENT_LABELS,
  DELETION_REASON_LABELS,
  DELIMITATION_LABELS,
  ETAT_LABELS,
  GESTIONNAIRE_LABELS,
  REVETEMENT_LABELS,
  SERVITUDE_LABELS,
  SOURCE_LABELS,
  TYPE_LABELS,
  type LocalPath,
} from "@/components/voies-locales/types";
import type {
  FieldChange,
  PublicationChange,
  PublishedPath,
  PublishedSegment,
} from "./types";

export interface PublishedEntry {
  hash: string;
  snapshot: PublishedPath;
}

export type ComputedChange = PublicationChange & PublishedEntry;

export function toPublishedPath(path: LocalPath): PublishedPath {
  return {
    id: path.id,
    codeInsee: path.codeInsee,
    ...(path.nom != null ? { nom: path.nom } : {}),
    classement: path.classement,
    numero: path.numero,
    ...(path.gestionnaire != null ? { gestionnaire: path.gestionnaire } : {}),
    dateDAffectation: path.dateDAffectation,
    ...(path.commentaire != null ? { commentaire: path.commentaire } : {}),
    ...(path.deletionReason != null
      ? { deletionReason: path.deletionReason }
      : {}),
    segments: [...path.segments]
      .sort((a, b) => a.ordre - b.ordre)
      .map(({ id: _id, servitudes, ...segment }) => ({
        ...segment,
        servitudes: [...servitudes].sort(),
      })),
  };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function hashPublishedPath(path: PublishedPath): string {
  return createHash("sha256").update(canonicalJson(path)).digest("hex");
}

const SEGMENT_ATTRIBUTES: {
  label: string;
  read: (s: PublishedSegment) => string | null;
}[] = [
  { label: "Type", read: (s) => TYPE_LABELS[s.type] },
  { label: "Revêtement", read: (s) => REVETEMENT_LABELS[s.revetement] },
  {
    label: "Largeur moyenne",
    read: (s) => (s.largeurMoyenne != null ? `${s.largeurMoyenne} m` : null),
  },
  { label: "État", read: (s) => ETAT_LABELS[s.etat] },
  {
    label: "Fermée à la circulation",
    read: (s) =>
      s.fermeALaCirculation == null
        ? null
        : s.fermeALaCirculation
          ? "Oui"
          : "Non",
  },
  {
    label: "Servitudes",
    read: (s) =>
      s.servitudes.length > 0
        ? s.servitudes.map((v) => SERVITUDE_LABELS[v]).join(", ")
        : null,
  },
  {
    label: "Délimitation",
    read: (s) => (s.delimitation ? DELIMITATION_LABELS[s.delimitation] : null),
  },
  { label: "Source du tracé", read: (s) => SOURCE_LABELS[s.source] },
];

const PATH_ATTRIBUTES: {
  label: string;
  read: (p: PublishedPath) => string | null;
}[] = [
  { label: "Appellation", read: (p) => p.nom ?? null },
  { label: "Numéro", read: (p) => String(p.numero) },
  { label: "Classement", read: (p) => CLASSEMENT_LABELS[p.classement] },
  {
    label: "Gestionnaire",
    read: (p) => (p.gestionnaire ? GESTIONNAIRE_LABELS[p.gestionnaire] : null),
  },
  { label: "Date d'affectation", read: (p) => p.dateDAffectation },
  { label: "Commentaire", read: (p) => p.commentaire ?? null },
];

function describeChanges(
  before: PublishedPath,
  after: PublishedPath,
): FieldChange[] {
  const fields: FieldChange[] = [];

  for (const { label, read } of PATH_ATTRIBUTES) {
    const b = read(before);
    const a = read(after);
    if (b !== a) fields.push({ label, before: b, after: a });
  }

  if (before.segments.length !== after.segments.length) {
    fields.push({
      label: "Nombre de segments",
      before: String(before.segments.length),
      after: String(after.segments.length),
    });
  }

  const common = Math.min(before.segments.length, after.segments.length);
  for (let i = 0; i < common; i++) {
    const bs = before.segments[i];
    const as = after.segments[i];
    const prefix = `Segment ${i + 1} – `;
    if (
      canonicalJson(bs.path.coordinates) !== canonicalJson(as.path.coordinates)
    ) {
      fields.push({
        label: `${prefix}Tracé`,
        before: "Ancien tracé",
        after: "Nouveau tracé",
      });
    }
    for (const { label, read } of SEGMENT_ATTRIBUTES) {
      const b = read(bs);
      const a = read(as);
      if (b !== a) fields.push({ label: `${prefix}${label}`, before: b, after: a });
    }
  }

  return fields;
}

const KIND_ORDER = { added: 0, modified: 1, deleted: 2 } as const;

/**
 * Compare l'état courant des voies à leur dernier état publié.
 * - `current` : voies qualifiées et non supprimées
 * - `deleted` : voies supprimées avec un motif (les suppressions sans motif, ex. fusion, ne sont pas publiées)
 */
export function computeChanges({
  current,
  deleted,
  published,
}: {
  current: LocalPath[];
  deleted: LocalPath[];
  published: Map<string, PublishedEntry>;
}): ComputedChange[] {
  const changes: ComputedChange[] = [];

  for (const path of current) {
    const snapshot = toPublishedPath(path);
    const hash = hashPublishedPath(snapshot);
    const previous = published.get(path.id);
    const base = {
      id: path.id,
      numero: path.numero,
      nom: path.nom ?? null,
      classement: path.classement,
      hash,
      snapshot,
    };
    if (!previous) {
      changes.push({ ...base, kind: "added", fields: [] });
    } else if (previous.hash !== hash) {
      changes.push({
        ...base,
        kind: "modified",
        fields: describeChanges(previous.snapshot, snapshot),
      });
    }
  }

  for (const path of deleted) {
    const previous = published.get(path.id);
    if (!previous || !path.deletionReason) continue;
    const snapshot = toPublishedPath(path);
    const hash = hashPublishedPath(snapshot);
    if (previous.hash === hash) continue;
    changes.push({
      id: path.id,
      kind: "deleted",
      numero: path.numero,
      nom: path.nom ?? null,
      classement: path.classement,
      fields: [
        {
          label: "Motif de suppression",
          before: null,
          after: DELETION_REASON_LABELS[path.deletionReason],
        },
      ],
      geometry: {
        type: "MultiLineString",
        coordinates: snapshot.segments.map((s) => s.path.coordinates),
      },
      hash,
      snapshot,
    });
  }

  return changes.sort(
    (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.numero - b.numero,
  );
}

export function toPublicChange({
  hash: _hash,
  snapshot: _snapshot,
  ...change
}: ComputedChange): PublicationChange {
  return change;
}
