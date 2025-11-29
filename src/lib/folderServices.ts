export type FolderServiceSource = {
  services?: unknown;
  serviceIds?: unknown;
  servicos?: unknown;
};

function sanitizeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function collectFolderServiceIds(source?: FolderServiceSource | null): string[] {
  if (!source) {
    console.log("[folderServices] collectFolderServiceIds: source é null ou undefined");
    return [];
  }
  const buckets = [source.services, source.serviceIds, source.servicos];
  const unique = new Set<string>();

  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue;
    for (const entry of bucket) {
      const id = sanitizeId(entry);
      if (id) {
        unique.add(id);
      }
    }
  }

  const result = Array.from(unique);
  console.log(
    `[folderServices] collectFolderServiceIds: encontrados ${result.length} serviços`,
    { buckets: buckets.map((b) => (Array.isArray(b) ? b.length : "não é array")) },
  );
  return result;
}
