import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Feature, FeatureCollection, Geometry } from "geojson";

const DATA_ROOT = path.join(process.cwd(), ".data");

interface StoreKey {
  communeInsee: string;
  pluginId: string;
}

function fileFor({ communeInsee, pluginId }: StoreKey): string {
  const safeCommune = communeInsee.replace(/[^0-9A-Za-z_-]/g, "_");
  const safePlugin = pluginId.replace(/[^0-9A-Za-z_-]/g, "_");
  return path.join(DATA_ROOT, safeCommune, `${safePlugin}.geojson`);
}

async function readCollection(key: StoreKey): Promise<FeatureCollection> {
  const file = fileFor(key);
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as FeatureCollection;
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { type: "FeatureCollection", features: [] };
    }
    throw err;
  }
}

async function writeCollection(key: StoreKey, fc: FeatureCollection): Promise<void> {
  const file = fileFor(key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(fc, null, 2), "utf8");
}

export const featureRepository = {
  async list(key: StoreKey): Promise<FeatureCollection> {
    return readCollection(key);
  },

  async create(key: StoreKey, feature: Feature<Geometry>): Promise<Feature<Geometry>> {
    const fc = await readCollection(key);
    const id = feature.id ?? randomUUID();
    const stored: Feature<Geometry> = { ...feature, id };
    fc.features.push(stored);
    await writeCollection(key, fc);
    return stored;
  },

  async update(key: StoreKey, id: string, patch: Feature<Geometry>): Promise<Feature<Geometry> | null> {
    const fc = await readCollection(key);
    const idx = fc.features.findIndex((f) => String(f.id) === id);
    if (idx === -1) return null;
    const merged: Feature<Geometry> = { ...patch, id };
    fc.features[idx] = merged;
    await writeCollection(key, fc);
    return merged;
  },

  async remove(key: StoreKey, id: string): Promise<boolean> {
    const fc = await readCollection(key);
    const before = fc.features.length;
    fc.features = fc.features.filter((f) => String(f.id) !== id);
    if (fc.features.length === before) return false;
    await writeCollection(key, fc);
    return true;
  },
};
