import "server-only";
import { db } from "./client";

export type BasemapKind = "openmaptiles" | "ortho" | "ign";

export const DEFAULT_BASEMAP: BasemapKind = "ortho";

export interface CommuneSettings {
  codeInsee: string;
  disabledPlugins: string[];
  basemap: BasemapKind;
}

interface Row {
  code_insee: string;
  disabled_plugins: string[];
  basemap: BasemapKind;
}

function defaults(codeInsee: string): CommuneSettings {
  return { codeInsee, disabledPlugins: [], basemap: DEFAULT_BASEMAP };
}

export async function getCommuneSettings(
  codeInsee: string,
): Promise<CommuneSettings> {
  const { rows } = await db().query<Row>(
    "SELECT code_insee, disabled_plugins, basemap FROM commune_settings WHERE code_insee = $1",
    [codeInsee],
  );
  if (rows.length === 0) return defaults(codeInsee);
  const row = rows[0];
  return {
    codeInsee: row.code_insee,
    disabledPlugins: row.disabled_plugins ?? [],
    basemap: row.basemap,
  };
}

export interface UpdateCommuneSettingsInput {
  disabledPlugins?: string[];
  basemap?: BasemapKind;
}

export async function upsertCommuneSettings(
  codeInsee: string,
  input: UpdateCommuneSettingsInput,
): Promise<CommuneSettings> {
  const { rows } = await db().query<Row>(
    `INSERT INTO commune_settings (code_insee, disabled_plugins, basemap)
     VALUES ($1, COALESCE($2, '{}'::text[]), COALESCE($3, 'ortho'::basemap_kind))
     ON CONFLICT (code_insee) DO UPDATE SET
       disabled_plugins = COALESCE(EXCLUDED.disabled_plugins, commune_settings.disabled_plugins),
       basemap = COALESCE(EXCLUDED.basemap, commune_settings.basemap)
     RETURNING code_insee, disabled_plugins, basemap`,
    [codeInsee, input.disabledPlugins ?? null, input.basemap ?? null],
  );
  const row = rows[0];
  return {
    codeInsee: row.code_insee,
    disabledPlugins: row.disabled_plugins,
    basemap: row.basemap,
  };
}
