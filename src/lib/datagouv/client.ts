import "server-only";

export interface DataGouvFile {
  filename: string;
  mimeType: string;
  content: string;
}

export interface DataGouvPublishResult {
  datasetId: string;
  resources: { filename: string; id: string; url: string }[];
}

interface DataGouvResource {
  id: string;
  title: string;
  url: string;
}

const REQUEST_TIMEOUT_MS = 60_000;

function getConfig() {
  const apiUrl = process.env.DATAGOUV_API_URL?.replace(/\/+$/, "");
  const apiKey = process.env.DATAGOUV_API_KEY;
  const datasetId = process.env.DATAGOUV_DATASET_ID;
  if (!apiUrl || !apiKey || !datasetId) {
    throw new Error(
      "Configuration data.gouv incomplète (DATAGOUV_API_URL, DATAGOUV_API_KEY, DATAGOUV_DATASET_ID).",
    );
  }
  return { apiUrl, apiKey, datasetId };
}

async function request<T>(
  apiKey: string,
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "X-API-KEY": apiKey,
      ...init.headers,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `data.gouv ${init.method ?? "GET"} ${url} : ${response.status} ${detail.slice(0, 300)}`,
    );
  }
  return (await response.json()) as T;
}

function uploadBody(file: DataGouvFile): FormData {
  const form = new FormData();
  form.append(
    "file",
    new Blob([file.content], { type: file.mimeType }),
    file.filename,
  );
  return form;
}

/**
 * Pousse chaque fichier dans le dataset : une ressource du même nom (titre) voit son fichier
 * remplacé, sinon la ressource est créée.
 */
export async function publishToDataGouv({
  files,
}: {
  codeInsee: string;
  files: DataGouvFile[];
}): Promise<DataGouvPublishResult> {
  const { apiUrl, apiKey, datasetId } = getConfig();
  const datasetUrl = `${apiUrl}/datasets/${encodeURIComponent(datasetId)}`;

  const dataset = await request<{ resources: DataGouvResource[] }>(
    apiKey,
    `${datasetUrl}/`,
  );

  const resources: DataGouvPublishResult["resources"] = [];
  for (const file of files) {
    const existing = dataset.resources.find(
      (r) => r.title === file.filename || r.url?.endsWith(`/${file.filename}`),
    );

    const uploaded = existing
      ? await request<DataGouvResource>(
          apiKey,
          `${datasetUrl}/resources/${encodeURIComponent(existing.id)}/upload/`,
          { method: "POST", body: uploadBody(file) },
        )
      : await request<DataGouvResource>(apiKey, `${datasetUrl}/upload/`, {
          method: "POST",
          body: uploadBody(file),
        });

    // Le titre d'une ressource créée par upload n'est pas garanti : il sert de clé au prochain envoi.
    if (!existing && uploaded.title !== file.filename) {
      await request(
        apiKey,
        `${datasetUrl}/resources/${encodeURIComponent(uploaded.id)}/`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: file.filename }),
        },
      );
    }

    resources.push({
      filename: file.filename,
      id: uploaded.id,
      url: uploaded.url,
    });
  }

  return { datasetId, resources };
}
