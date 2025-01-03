import { existsSync } from 'fs';

import { readdir, readFile } from 'fs/promises';

import { dirname, isAbsolute, join as pathJoin } from 'path';

import { Uri } from 'vscode';

import { parse as jsonParse } from 'jsonc-parser';

import { compareWorkspaceInfo } from './utils';

import type { ParseOptions } from 'jsonc-parser';

export type WorkspaceType = 'error' | 'folder' | 'remote' | 'workspace';
export type RemoteWorkspaceType = 'dev-container' | 'github' | 'github-codespaces' | 'ssh' | 'wsl';

type WorkspaceStorage =
  | {}
  | {
      folder: string;
    }
  | {
      workspace: string;
    };

type WorkspaceFile = {
  folders?: Array<WorkspaceFolder>;
};

type PathOrUri =
  | {
      path: string;
    }
  | {
      uri: string;
    };

type WorkspaceFolder = {
  name?: string;
} & PathOrUri;

export type WorkspaceFolderInfo =
  | {
      path: string;
      exists: boolean;
    }
  | {
      error: string;
    };

type WorkspaceTargetInfo =
  | {
      type: 'folder';
      folder: WorkspaceFolderInfo;
    }
  | {
      type: 'workspace';
      workspace: WorkspaceFileInfo;
    }
  | {
      type: 'remote';
      remote: RemoteWorkspaceInfo;
    }
  | {
      type: 'error';
      error: string;
    };

export type WorkspaceInfo = {
  type: WorkspaceType;
  name: string;
} & WorkspaceTargetInfo;

export type WorkspaceFileInfo = {
  path: string;
  exists: boolean;
  folders: Array<WorkspaceFolderInfo>;
};

export type RemoteWorkspaceInfo = {
  type: RemoteWorkspaceType;
  path: string;
  authority: string;
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

  workspaces.sort(compareWorkspaceInfo);

  return workspaces;
}

async function getWorkspaceInfoAsync(workspaceStorageRootPath: string, dir: string): Promise<WorkspaceInfo> {
  try {
    const workspaceStoragePath = pathJoin(workspaceStorageRootPath, dir);

    const workspaceStorageFilePath = pathJoin(workspaceStoragePath, 'workspace.json');

    if (!existsSync(workspaceStorageFilePath)) {
      return {
        type: 'error',
        name: dir,
        error: `No workspace.json under ${workspaceStoragePath}`
      };
    }

    const workspaceStorageFileContent = await readFile(workspaceStorageFilePath, 'utf8');

    const workspaceStorage = jsonParse(workspaceStorageFileContent, [], jsonParseOptions) as WorkspaceStorage;

    if ('workspace' in workspaceStorage) {
      const workspaceFileUri = Uri.parse(workspaceStorage.workspace);

      if (!workspaceFileUri) {
        return {
          type: 'error',
          name: dir,
          error: `Invalid workspace file URI (${workspaceStorage.workspace}) in ${workspaceStorageFilePath}`
        };
      }

      if (workspaceFileUri.scheme === 'file') {
        const workspaceFileContent = await readFile(workspaceFileUri.fsPath, 'utf8');

        const workspaceFile = jsonParse(workspaceFileContent, [], jsonParseOptions) as WorkspaceFile;

        if (!workspaceFile.folders) {
          return {
            type: 'error',
            name: dir,
            error: `No folders key exists in workspace file ${workspaceFileUri.fsPath}`
          };
        }

        const folders: Array<WorkspaceFolderInfo> = workspaceFile.folders.map((folder: WorkspaceFolder) => {
          if ('path' in folder) {
            if (isAbsolute(folder.path)) {
              return <WorkspaceFolderInfo>{
                path: folder.path,
                exists: existsSync(folder.path)
              };
            }

            const workspaceFolderPath = pathJoin(dirname(workspaceFileUri.fsPath), folder.path);

            return <WorkspaceFolderInfo>{
              path: workspaceFolderPath,
              exists: existsSync(workspaceFolderPath)
            };
          }

          if ('uri' in folder) {
            const pathUri = Uri.parse(folder.uri);

            if (pathUri.scheme === 'file') {
              if (isAbsolute(pathUri.fsPath)) {
                return <WorkspaceFolderInfo>{
                  path: pathUri.fsPath,
                  exists: existsSync(pathUri.fsPath)
                };
              }

              const workspaceFolderPath = pathJoin(dirname(workspaceFileUri.fsPath), pathUri.fsPath);

              return <WorkspaceFolderInfo>{
                path: workspaceFolderPath,
                exists: existsSync(workspaceFolderPath)
              };
            }

            return <WorkspaceFolderInfo>{
              error: `No path exists but found a non-file uri: ${folder?.uri}`
            };
          }

          return <WorkspaceFolderInfo>{
            error: 'No path or uri exists for folder'
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
        error: `Workspace file URI scheme (${workspaceFileUri.scheme}) is not file in ${workspaceStorageFilePath}`
      };
    }

    if ('folder' in workspaceStorage) {
      const workspacePathUri = Uri.parse(workspaceStorage.folder);

      if (!workspacePathUri) {
        return {
          type: 'error',
          name: dir,
          error: `Invalid workspace folder URI (${workspaceStorage.folder}) in ${workspaceStorageFilePath}`
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

      const remoteWorkspace = parseRemoteWorkspaceUri(
        workspacePathUri.authority,
        workspacePathUri.scheme,
        workspacePathUri.path
      );

      if (remoteWorkspace) {
        return {
          type: 'remote',
          name: dir,
          remote: remoteWorkspace
        };
      }

      return {
        type: 'error',
        name: dir,
        error: `Workspace URI scheme (${workspacePathUri.scheme}) or authority (${workspacePathUri.authority}) is not recognized in ${workspaceStorageFilePath}`
      };
    }

    return {
      type: 'error',
      name: dir,
      error: `No workspace folder or file URI in ${workspaceStorageFilePath}`
    };
  } catch (err) {
    return {
      type: 'error',
      name: dir,
      error: `Error occurred when processing folder ${dir} in ${workspaceStorageRootPath}: ${err}`
    };
  }
}

function parseRemoteWorkspaceUri(authority: string, scheme: string, path: string): RemoteWorkspaceInfo | undefined {
  if (scheme === 'vscode-remote') {
    switch (authority.split('+')[0]) {
      case 'codespaces':
        return { type: 'github-codespaces', authority, path };
      case 'dev-container':
        return { type: 'dev-container', authority, path };
      case 'ssh':
      case 'ssh-remote':
        return { type: 'ssh', authority, path };
      case 'wsl':
        return { type: 'wsl', authority, path };
    }
  } else if (scheme === 'vscode-vfs') {
    switch (authority.split('+')[0]) {
      case 'github':
        return { type: 'github', authority, path };
    }
  }

  return undefined;
}