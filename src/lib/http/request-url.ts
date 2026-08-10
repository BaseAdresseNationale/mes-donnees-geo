export function resolveAppUrl(request: Request, pathWithQuery: string): URL {
  const headers = request.headers;
  const forwardedHost = headers.get("x-forwarded-host");
  const forwardedProto = headers.get("x-forwarded-proto");

  if (forwardedHost) {
    const proto = forwardedProto?.split(",")[0]?.trim() || "https";
    return new URL(
      pathWithQuery,
      `${proto}://${forwardedHost.split(",")[0].trim()}`,
    );
  }

  return new URL(pathWithQuery, request.url);
}
