import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "@jest/globals";
import { lineString } from "@turf/helpers";
import turfLength from "@turf/length";
import type { Position } from "geojson";
import {
  LocalPathClassement,
  LocalPathSource,
} from "@/generated/prisma/browser";
import type { BdTopoTronconCandidate } from "./bd-topo";
import {
  assembleLocalPaths,
  type AssembledLocalPath,
  type CadastralRuralPathGeometry,
} from "./local-path-cadastre-matching";

// Commune 30228 : tronçons BD TOPO (WFS) et habillage cadastral (zoncommuni) réels,
// restreints aux tronçons situés à proximité d'un filaire cadastral.
const fixture = JSON.parse(
  readFileSync(
    join(process.cwd(), "src/lib/geo/__fixtures__/commune-30228.json"),
    "utf8",
  ),
) as {
  candidates: BdTopoTronconCandidate[];
  cadastralPaths: CadastralRuralPathGeometry[];
};

function lengthOf(path: AssembledLocalPath): number {
  return path.segments.reduce(
    (sum, segment) => sum + segmentLength(segment.path.coordinates),
    0,
  );
}

function segmentLength(coordinates: Position[]): number {
  return turfLength(lineString(coordinates), { units: "meters" });
}

describe("assembleLocalPaths (commune 30228)", () => {
  let paths: AssembledLocalPath[];

  beforeAll(async () => {
    paths = await assembleLocalPaths(
      fixture.candidates,
      fixture.cadastralPaths,
    );
  });

  it("reconstitue les voies de la commune", () => {
    expect(paths).toHaveLength(32);
  });

  it("donne une clé unique à chaque voie", () => {
    expect(new Set(paths.map((path) => path.key)).size).toBe(paths.length);
  });

  it("est déterministe", async () => {
    const again = await assembleLocalPaths(
      fixture.candidates,
      fixture.cadastralPaths,
    );
    expect(again.map((path) => path.key)).toEqual(
      paths.map((path) => path.key),
    );
    expect(again.map(lengthOf)).toEqual(paths.map(lengthOf));
  });

  it("réunit le chemin n°23 du Plateau de Saint-Nicolas en une seule voie", () => {
    const plateau = paths.filter(
      (path) => path.nom === "Chemin du Plateau de Saint-Nicolas",
    );

    expect(plateau).toHaveLength(1);
    const [voie] = plateau;
    expect(voie.numero).toBe(23);
    expect(voie.classement).toBe(LocalPathClassement.CHEMIN_RURAL);
    expect(lengthOf(voie)).toBeGreaterThan(3270);
    expect(lengthOf(voie)).toBeLessThan(3285);
  });

  it("relie le trou BD TOPO du Plateau par un seul segment manuel court", () => {
    const voie = paths.find(
      (path) => path.nom === "Chemin du Plateau de Saint-Nicolas",
    )!;
    const manuels = voie.segments.filter(
      (segment) => segment.source === LocalPathSource.MANUEL,
    );

    expect(manuels).toHaveLength(1);
    expect(segmentLength(manuels[0].path.coordinates)).toBeLessThan(50);
  });

  it("emprunte le tronçon BD TOPO qui relie les deux morceaux de 872 m et 376 m", () => {
    const voie = paths.find(
      (path) => path.nom === "Chemin du Plateau de Saint-Nicolas",
    )!;

    expect(voie.segments.map((segment) => segment.sourceRef)).toContain(
      "TRONROUT0000000027894925",
    );
  });

  it("limite les segments manuels à 200 m", () => {
    const manuels = paths.flatMap((path) =>
      path.segments.filter(
        (segment) => segment.source === LocalPathSource.MANUEL,
      ),
    );

    expect(manuels.length).toBeGreaterThan(0);
    for (const segment of manuels) {
      expect(segmentLength(segment.path.coordinates)).toBeLessThanOrEqual(200);
      expect(segment.sourceRef).toBeNull();
    }
  });

  it("produit des chaînes de segments contiguës", () => {
    const ruptures = paths.flatMap((path) =>
      path.segments.slice(1).flatMap((segment, index) => {
        const previous = path.segments[index].path.coordinates;
        const gap = segmentLength([
          previous[previous.length - 1],
          segment.path.coordinates[0],
        ]);
        return gap < 2 ? [] : [`${path.key} (segment ${index + 1})`];
      }),
    );

    expect(ruptures).toEqual([]);
  });

  it("n'utilise chaque tronçon BD TOPO qu'une seule fois", () => {
    const refs = paths.flatMap((path) =>
      path.segments.flatMap((segment) =>
        segment.sourceRef ? [segment.sourceRef] : [],
      ),
    );

    expect(new Set(refs).size).toBe(refs.length);
  });

  it("ne retient que des voies couvrant au moins 80 % du filaire cadastral", () => {
    const peuCouvertes = paths
      .filter((path) => (path.couverture ?? 0) < 0.8)
      .map((path) => path.key);

    expect(peuCouvertes).toEqual([]);
  });

  it("complète les noms manquants avec ceux de la BD TOPO", () => {
    const noms = paths.map((path) => path.nom);

    expect(noms).toContain("Chemin du Roullet");
    expect(noms).toContain("Chemin de Campagnac");
    expect(paths.filter((path) => !path.nom)).toHaveLength(1);
  });
});
