import { Dirent } from 'fs';

import { readdir, stat } from 'fs/promises';

import { join as pathJoin } from 'path';

import { window } from 'vscode';

import type { WorkspaceInfo } from './workspace';

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

export function sortWorkspaceInfoArray(first: WorkspaceInfo, second: WorkspaceInfo): number {
  let firstValue = '';

  switch (first.type) {
    case 'error':
      firstValue = first.error!;
      break;

    case 'folder':
      firstValue = `folder-${first.folder!.path}`;
      break;

    case 'remote':
      switch (first.remote!.type) {
        case 'dev-container':
          firstValue = `remote-dev-container-${first.remote!.path}`;
          break;

        case 'github':
          firstValue = `remote-github-${first.remote!.path}`;
          break;

        case 'github-codespaces':
          firstValue = `remote-github-codespaces-${first.remote!.path}`;
          break;

        case 'ssh':
          firstValue = `remote-ssh-${first.remote!.path}`;
          break;

        case 'wsl':
          firstValue = `remote-wsl-${first.remote!.path}`;
          break;
      }
      break;

    case 'workspace':
      firstValue = `workspace-${first.workspace!.path}`;
      break;
  }

  let secondValue = '';

  switch (second.type) {
    case 'error':
      secondValue = second.error!;
      break;

    case 'folder':
      secondValue = `folder-${second.folder!.path}`;
      break;

    case 'remote':
      switch (second.remote!.type) {
        case 'dev-container':
          secondValue = `remote-dev-container-${second.remote!.path}`;
          break;

        case 'github':
          secondValue = `remote-github-${second.remote!.path}`;
          break;

        case 'github-codespaces':
          secondValue = `remote-github-codespaces-${second.remote!.path}`;
          break;

        case 'ssh':
          secondValue = `remote-ssh-${second.remote!.path}`;
          break;

        case 'wsl':
          secondValue = `remote-wsl-${second.remote!.path}`;
          break;
      }
      break;

    case 'workspace':
      secondValue = `workspace-${second.workspace!.path}`;
      break;
  }

  if (firstValue > secondValue) {
    return 1;
  }

  if (firstValue < secondValue) {
    return -1;
  }

  if (first.name > second.name) {
    return 1;
  }

  if (first.name < second.name) {
    return -1;
  }

  return 0;
}