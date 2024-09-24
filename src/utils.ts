import { Dirent } from 'fs';

import { readdir, stat } from 'fs/promises';

import { join as pathJoin } from 'path';

import { window } from 'vscode';

const nonceCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export async function getDirSizeAsync(dirPath: string): Promise<number> {
  let totalSize = 0;

  const stack: Array<string> = [dirPath];

  while (stack.length > 0) {
    const currentPath = stack.pop()!;

    let entries: Array<Dirent>;

    try {
      entries = await readdir(currentPath, { withFileTypes: true });
    } catch (err) {
      window.showErrorMessage(`Error occured when reading '${currentPath}' (${err})`);

      return 0;
    }

    const statPromises = entries.map(async entry => {
      const entryPath = pathJoin(currentPath, entry.name);

      if (entry.isFile()) {
        try {
          const stats = await stat(entryPath);

          totalSize += stats.size;
        } catch (err) {
          window.showErrorMessage(`Error occured when getting file size of '${entryPath}' (${err})`);

          return 0;
        }
      } else if (entry.isDirectory()) {
        stack.push(entryPath);
      }
    });

    await Promise.all(statPromises);
  }

  return totalSize;
}

export function getNonce(): string {
  const characters: Array<string> = [];

  for (let i = 0; i < 32; i++) {
    characters.push(nonceCharacters.charAt(Math.floor(Math.random() * nonceCharacters.length)));
  }

  return characters.join('');
}