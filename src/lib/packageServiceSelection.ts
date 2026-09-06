export type PackageServiceSelection = {
  folderServiceIds: string[];
  missingServiceIds: string[];
};

/**
 * Resolves the services referenced directly by subpackages without relying on
 * the (occasionally stale) aggregate array stored in the package document.
 */
export function selectMissingFolderServices(
  folderServiceLists: ReadonlyArray<ReadonlyArray<string>>,
  loadedServiceIds: Iterable<string>,
): PackageServiceSelection {
  const loaded = new Set(Array.from(loadedServiceIds, (id) => id.trim()).filter(Boolean));
  const folderServiceIds = Array.from(
    new Set(folderServiceLists.flatMap((ids) => ids.map((id) => id.trim()).filter(Boolean))),
  );
  const missing = folderServiceIds.filter((id) => !loaded.has(id));

  return {
    folderServiceIds,
    missingServiceIds: missing,
  };
}
