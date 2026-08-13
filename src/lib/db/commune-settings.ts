import "server-only";
import { prisma } from "./prisma";

export interface CommuneSettings {
  codeInsee: string;
  disabledPlugins: string[];
}

function defaults(codeInsee: string): CommuneSettings {
  return { codeInsee, disabledPlugins: [] };
}

export async function getCommuneSettings(
  codeInsee: string,
): Promise<CommuneSettings> {
  const row = await prisma.communeSettings.findUnique({
    where: { codeInsee },
    select: { codeInsee: true, disabledPlugins: true },
  });
  if (!row) return defaults(codeInsee);
  return {
    codeInsee: row.codeInsee,
    disabledPlugins: row.disabledPlugins,
  };
}

export interface UpdateCommuneSettingsInput {
  disabledPlugins?: string[];
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
    },
    update: {
      ...(input.disabledPlugins !== undefined && {
        disabledPlugins: input.disabledPlugins,
      }),
    },
    select: { codeInsee: true, disabledPlugins: true },
  });
  return {
    codeInsee: row.codeInsee,
    disabledPlugins: row.disabledPlugins,
  };
}
