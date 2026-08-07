import "server-only";
import { BasemapKind as PrismaBasemapKind } from "@prisma/client";
import { prisma } from "./prisma";

export type BasemapKind = PrismaBasemapKind;

export const DEFAULT_BASEMAP: BasemapKind = PrismaBasemapKind.ortho;

export interface CommuneSettings {
  codeInsee: string;
  disabledPlugins: string[];
  basemap: BasemapKind;
}

function defaults(codeInsee: string): CommuneSettings {
  return { codeInsee, disabledPlugins: [], basemap: DEFAULT_BASEMAP };
}

export async function getCommuneSettings(
  codeInsee: string,
): Promise<CommuneSettings> {
  const row = await prisma.communeSettings.findUnique({
    where: { codeInsee },
    select: { codeInsee: true, disabledPlugins: true, basemap: true },
  });
  if (!row) return defaults(codeInsee);
  return {
    codeInsee: row.codeInsee,
    disabledPlugins: row.disabledPlugins,
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
  const row = await prisma.communeSettings.upsert({
    where: { codeInsee },
    create: {
      codeInsee,
      disabledPlugins: input.disabledPlugins ?? [],
      basemap: input.basemap ?? DEFAULT_BASEMAP,
    },
    update: {
      ...(input.disabledPlugins !== undefined && {
        disabledPlugins: input.disabledPlugins,
      }),
      ...(input.basemap !== undefined && { basemap: input.basemap }),
    },
    select: { codeInsee: true, disabledPlugins: true, basemap: true },
  });
  return {
    codeInsee: row.codeInsee,
    disabledPlugins: row.disabledPlugins,
    basemap: row.basemap,
  };
}
