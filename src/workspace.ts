import { existsSync } from 'fs';

import { readdir, readFile } from 'fs/promises';

import { dirname, isAbsolute, join as pathJoin } from 'path';

import { Uri } from 'vscode';

import { parse as jsonParse } from 'jsonc-parser';

import { sortWorkspaceInfoArray } from './utils';

import type { ParseOptions } from 'jsonc-parser';

export type WorkspaceType = 'error' | 'folder' | 'remote' | 'workspace';
export type RemoteWorkspaceType = 'dev-container' | 'github' | 'github-codespaces' | 'ssh' | 'wsl';

export type PathWithExists = {
  path: string;
  exists: boolean;
};

export type WorkspaceFolderInfo = {
  path: string;
};

export type WorkspaceFileInfo = {
  path: string;
  exists: boolean;
  folders: Array<PathWithExists>;
};

export type RemoteWorkspaceInfo = {
  type: RemoteWorkspaceType;
  path: string;
  authority: string;
};

export type WorkspaceInfo = {
  type: WorkspaceType;
  name: string;
  folder?: PathWithExists;
  workspace?: WorkspaceFileInfo;
  remote?: RemoteWorkspaceInfo;
  error?: string;
};

const jsonParseOptions: ParseOptions = {
  disallowComments: false,
  allowTrailingComma: true,
  allowEmptyContent: true
};

export async function getWorkspacesAsync(workspaceStorageRootPath: string): Promise<Array<WorkspaceInfo>> {
  const allItems = await readdir(workspaceStorageRootPath, { withFileTypes: true });

  const directories = allItems.filter(i => i.isDirectory()).map(dir => dir.name);

  const workspaces: Array<WorkspaceInfo> = await Promise.all(
    directories.map(dir => getWorkspaceInfoAsync(workspaceStorageRootPath, dir))
  );

  workspaces.sort(sortWorkspaceInfoArray);

  return workspaces;
}

async function getWorkspaceInfoAsync(workspaceStorageRootPath: string, dir: string): Promise<WorkspaceInfo> {
  const workspaceStoragePath = pathJoin(workspaceStorageRootPath, dir);

  const workspaceInfoFilePath = pathJoin(workspaceStoragePath, 'workspace.json');

  if (!existsSync(workspaceInfoFilePath)) {
    return {
      type: 'error',
      name: dir,
      error: `No workspace.json under ${workspaceStoragePath}`
    };
  }

  const workspaceMetaFileContent = await readFile(workspaceInfoFilePath, 'utf8');

  const workspaceMeta = jsonParse(workspaceMetaFileContent, [], jsonParseOptions);

  if (workspaceMeta.workspace) {
    const workspaceFileUri = Uri.parse(workspaceMeta.workspace);

    if (!workspaceFileUri) {
      return {
        type: 'error',
        name: dir,
        error: `Invalid workspace file URI (${workspaceMeta.workspace}) in ${workspaceInfoFilePath}`
      };
    }

    if (workspaceFileUri.scheme === 'file') {
      const workspaceFileContent = await readFile(workspaceFileUri.fsPath, 'utf8');

      const workspaceFile = jsonParse(workspaceFileContent, [], jsonParseOptions);

      const folders: Array<PathWithExists> = workspaceFile.folders.map((folder: WorkspaceFolderInfo) => {
        if (isAbsolute(folder.path)) {
          return <PathWithExists>{
            path: folder.path,
            exists: existsSync(folder.path)
          };
        }

        const workspaceFolderPath = pathJoin(dirname(workspaceFileUri.fsPath), folder.path);

        return <PathWithExists>{
          path: workspaceFolderPath,
          exists: existsSync(workspaceFolderPath)
        };
      });

      return {
        type: 'workspace',
        name: dir,
        workspace: {
          path: workspaceFileUri.fsPath,
          exists: existsSync(workspaceFileUri.fsPath),
          folders
        }
      };
    }

    return {
      type: 'error',
      name: dir,
      error: `Workspace file URI scheme (${workspaceFileUri.scheme}) is not file in ${workspaceInfoFilePath}`
    };
  }

  if (workspaceMeta.folder) {
    const workspacePathUri = Uri.parse(workspaceMeta.folder);

    if (!workspacePathUri) {
      return {
        type: 'error',
        name: dir,
        error: `Invalid workspace folder URI (${workspaceMeta.folder}) in ${workspaceInfoFilePath}`
      };
    }

    if (workspacePathUri.scheme === 'file') {
      return {
        type: 'folder',
        name: dir,
        folder: {
          path: workspacePathUri.fsPath,
          exists: existsSync(workspacePathUri.fsPath)
        }
      };
    }

    const authority = workspacePathUri.authority.split('+')[0];

    if (workspacePathUri.scheme === 'vscode-remote') {
      switch (authority) {
        case 'codespaces':
          return {
            type: 'remote',
            name: dir,
            remote: {
              type: 'github-codespaces',
              authority,
              path: workspacePathUri.path
            }
          };

        case 'dev-container':
          return {
            type: 'remote',
            name: dir,
            remote: {
              type: 'dev-container',
              authority,
              path: workspacePathUri.path
            }
          };

        case 'ssh':
        case 'ssh-remote':
          return {
            type: 'remote',
            name: dir,
            remote: {
              type: 'ssh',
              authority,
              path: workspacePathUri.path
            }
          };

        case 'wsl':
          return {
            type: 'remote',
            name: dir,
            remote: {
              type: 'wsl',
              authority,
              path: workspacePathUri.path
            }
          };
      }
    }

    if (workspacePathUri.scheme === 'vscode-vfs') {
      switch (authority) {
        case 'github':
          return {
            type: 'remote',
            name: dir,
            remote: {
              type: 'github',
              authority,
              path: workspacePathUri.path
            }
          };
      }
    }

    return {
      type: 'error',
      name: dir,
      error: `Workspace URI scheme (${workspacePathUri.scheme}) or authority (${authority}) is not recognized in ${workspaceInfoFilePath}`
    };
  }

  return {
    type: 'error',
    name: dir,
    error: `No workspace folder or file URI in ${workspaceInfoFilePath}`
  };
}
