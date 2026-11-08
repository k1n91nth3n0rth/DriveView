/**
 * Decide which Drive folders the folder picker should show.
 *
 * Some folder trees are huge and mostly noise (for example a ComfyUI install
 * with its models, custom nodes and cache directories). Those trees are
 * collapsed down to a single "output" folder, while everything else in the
 * Drive is shown untouched.
 *
 * Pure function, no React — see folderFilter.test.js.
 */
export function visibleFolders(allFolders, { groupName = 'ComfyUI', keepName = 'output' } = {}) {
  const groupIds = new Set(
    allFolders.filter((folder) => folder.name === groupName).map((folder) => folder.id)
  );

  // Nothing to collapse: show the Drive as-is.
  if (groupIds.size === 0) return allFolders;

  const excluded = new Set();
  const kept = new Set();

  const markDescendants = (parentId) => {
    allFolders.forEach((folder) => {
      if (!folder.parents || !folder.parents.includes(parentId)) return;
      if (folder.name.toLowerCase() === keepName) {
        // Keep the output folder visible and stop descending into it.
        kept.add(folder.id);
      } else {
        excluded.add(folder.id);
        markDescendants(folder.id);
      }
    });
  };

  groupIds.forEach((id) => {
    markDescendants(id);
    excluded.add(id);
  });

  return allFolders.filter((folder) => !excluded.has(folder.id) || kept.has(folder.id));
}
