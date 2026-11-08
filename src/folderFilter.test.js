import { visibleFolders } from './folderFilter';

const folder = (id, name, parents = []) => ({ id, name, parents });

test('returns every folder when there is nothing to collapse', () => {
  const folders = [folder('1', 'Photos'), folder('2', 'Docs', ['1'])];

  expect(visibleFolders(folders)).toHaveLength(2);
});

test('collapses a ComfyUI tree but keeps its output folders', () => {
  const folders = [
    folder('c', 'ComfyUI'),
    folder('m', 'models', ['c']),
    folder('o', 'output', ['c']),
    folder('d', 'deep-nested', ['m']),
    folder('p', 'Photos'),
  ];

  const visibleIds = visibleFolders(folders)
    .map((f) => f.id)
    .sort();

  expect(visibleIds).toEqual(['o', 'p']);
});

test('handles folders with no parents array without throwing', () => {
  const folders = [{ id: 'x', name: 'Loose' }, folder('c', 'ComfyUI')];

  expect(visibleFolders(folders).map((f) => f.id)).toEqual(['x']);
});
