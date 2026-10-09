import "server-only";

export interface DataGouvFile {
  filename: string;
  mimeType: string;
  content: string;
}

export interface DataGouvPublishResult {
  datasetId: string;
  resources: { filename: string; url: string }[];
}

/**
 * Mock : n'appelle pas encore l'API data.gouv.fr.
 * À remplacer par le téléversement des ressources (CSV + GeoJSON) sur DATAGOUV_DATASET_ID.
 */
export async function publishToDataGouv({
  codeInsee,
  files,
}: {
  codeInsee: string;
  files: DataGouvFile[];
}): Promise<DataGouvPublishResult> {
  const datasetId = process.env.DATAGOUV_DATASET_ID || "mock-dataset";
  console.info(
    `[data.gouv mock] ${codeInsee} : ${files.length} ressource(s) vers le dataset ${datasetId}`,
    files.map((f) => `${f.filename} (${f.content.length} car.)`),
  );
  return {
    datasetId,
    resources: files.map((f) => ({
      filename: f.filename,
      url: `https://www.data.gouv.fr/datasets/${datasetId}/#mock-${f.filename}`,
    })),
  };
}
