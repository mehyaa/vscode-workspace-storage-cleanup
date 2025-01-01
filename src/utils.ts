import { Dirent } from 'fs';

import { readdir, stat } from 'fs/promises';

import { join as pathJoin } from 'path';

import { window } from 'vscode';

import type { WorkspaceInfo } from './workspace';

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

const nonceCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function getNonce(): string {
  const characters: Array<string> = [];

  for (let i = 0; i < 32; i++) {
    characters.push(nonceCharacters.charAt(Math.floor(Math.random() * nonceCharacters.length)));
  }

  return characters.join('');
}

export function compareWorkspaceInfo(first: WorkspaceInfo, second: WorkspaceInfo): number {
  const firstValue = getWorkspaceInfoCompareValue(first);
  const secondValue = getWorkspaceInfoCompareValue(second);

  if (firstValue > secondValue) return 1;
  if (firstValue < secondValue) return -1;

  return 0;
}

function getWorkspaceInfoCompareValue(workspace: WorkspaceInfo): string {
  switch (workspace.type) {
    case 'error':
      return `0error-${workspace.error!}`;

    case 'folder':
      return `1folder-${workspace.folder!.path}`;

    case 'remote':
      switch (workspace.remote!.type) {
        case 'dev-container':
          return `3remote-dev-container-${workspace.remote!.path}`;

        case 'github':
          return `4remote-github-${workspace.remote!.path}`;

        case 'github-codespaces':
          return `5remote-github-codespaces-${workspace.remote!.path}`;

        case 'ssh':
          return `6remote-ssh-${workspace.remote!.path}`;

        case 'wsl':
          return `7remote-wsl-${workspace.remote!.path}`;
      }

    case 'workspace':
      return `2workspace-${workspace.workspace!.path}`;

    default:
      return `000-${workspace.name}`;
  }
}