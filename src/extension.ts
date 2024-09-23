import { Dirent, existsSync } from 'fs';

import { readdir, readFile, rmdir, stat } from 'fs/promises';

import { dirname, join as pathJoin } from 'path';

import { commands, env, window, ExtensionContext, Uri, ViewColumn, WebviewPanel } from 'vscode';

type WorkspaceInfo = {
  name: string;
  path?: string;
  pathExists?: boolean;
  url?: string;
  note?: string;
  workspaceSize?: number;
  storageSize?: number;
};

type WebviewMessage =
  | {
      command: 'refresh';
    }
  | {
      command: 'delete';
      workspaces: Array<string>;
    }
  | {
      command: 'get-storage-size';
      name: string;
    }
  | {
      command: 'get-workspace-size';
      name: string;
    }
  | {
      command: 'get-all-storage-sizes';
    }
  | {
      command: 'get-all-workspace-sizes';
    }
  | {
      command: 'browse-workspace';
      name: string;
    };

const nonceCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function activate(context: ExtensionContext) {
  let currentPanel: WebviewPanel | undefined = undefined;
  let currentPanelDisposed: boolean = false;

  let workspaces: Array<WorkspaceInfo> = [];

  context.subscriptions.push(
    commands.registerCommand('workspace-storage-cleanup.run', () => showWorkspacePanelAsync(context))
  );

  async function showWorkspacePanelAsync(context: ExtensionContext): Promise<void> {
    const globalStoragePath = dirname(context.globalStorageUri.fsPath);

    if (!globalStoragePath) {
      window.showErrorMessage('Could not get global storage path.');

      return;
    }

    const vscodeProfilePath = dirname(globalStoragePath);

    const workspaceStorageRootPath = pathJoin(vscodeProfilePath, 'workspaceStorage');

    async function handleWebviewMessage(message: WebviewMessage): Promise<void> {
      switch (message.command) {
        case 'refresh':
          {
            workspaces = await getWorkspacesAsync(workspaceStorageRootPath);

            await postWorkspacesToWebview(workspaces);
          }

          break;

        case 'delete':
          if (message.workspaces && message.workspaces.length > 0) {
            const errorMessages: Array<string> = [];

            for (const workspace of message.workspaces) {
              const dirPath = pathJoin(workspaceStorageRootPath, workspace);

              try {
                await rmdir(dirPath, { recursive: true });
              } catch (err) {
                const error = err as Error;

                if (error) {
                  errorMessages.push(error.message);
                }
              }
            }

            if (errorMessages.length > 0) {
              window.showErrorMessage(errorMessages.join('\n'));
            }

            workspaces = await getWorkspacesAsync(workspaceStorageRootPath);

            await postWorkspacesToWebview(workspaces);
          }

          break;

        case 'get-storage-size':
          {
            const workspaceStoragePath = pathJoin(workspaceStorageRootPath, message.name);

            if (existsSync(workspaceStoragePath)) {
              const storageSize = await getDirSizeAsync(workspaceStoragePath);

              postStorageSizeToWebview(message.name, storageSize);
            }
          }

          break;

        case 'get-workspace-size':
          {
            const workspace = workspaces.find(w => w.name === message.name);

            if (workspace && workspace.path && existsSync(workspace.path)) {
              const workspaceSize = await getDirSizeAsync(workspace.path);

              postWorkspaceSizeToWebview(workspace.name, workspaceSize);
            }
          }

          break;

        case 'get-all-storage-sizes':
          {
            for (const workspace of workspaces) {
              const workspaceStoragePath = pathJoin(workspaceStorageRootPath, workspace.name);

              const storageSize = await getDirSizeAsync(workspaceStoragePath);

              postStorageSizeToWebview(workspace.name, storageSize);
            }
          }

          break;

        case 'get-all-workspace-sizes':
          {
            for (const workspace of workspaces) {
              if (workspace && workspace.path && existsSync(workspace.path)) {
                const workspaceSize = await getDirSizeAsync(workspace.path);

                postWorkspaceSizeToWebview(workspace.name, workspaceSize);
              }
            }
          }

          break;

        case 'browse-workspace':
          {
            const workspaceStoragePath = pathJoin(workspaceStorageRootPath, message.name);

            if (existsSync(workspaceStoragePath)) {
              const success = env.openExternal(Uri.file(workspaceStoragePath));

              if (!success) {
                window.showErrorMessage(`Could not open '${workspaceStoragePath}'`);
              }
            }
          }

          break;
      }
    }

    await initializeWebviewAsync(context, handleWebviewMessage);
  }

  async function initializeWebviewAsync(
    context: ExtensionContext,
    handleWebviewMessage: (message: WebviewMessage) => Promise<void>
  ): Promise<void> {
    if (currentPanel && !currentPanelDisposed) {
      currentPanel.reveal(ViewColumn.One, false);
    } else {
      currentPanel = window.createWebviewPanel(
        'workspace-storage-cleanup.run',
        'Workspace Storage',
        {
          viewColumn: ViewColumn.One,
          preserveFocus: false
        },
        {
          enableScripts: true,
          localResourceRoots: [Uri.file(pathJoin(context.extensionPath, 'media'))],
          retainContextWhenHidden: true
        }
      );

      context.subscriptions.push(currentPanel);

      currentPanel.onDidDispose(() => {
        currentPanel = undefined;
        currentPanelDisposed = true;
      });

      currentPanel.webview.onDidReceiveMessage(handleWebviewMessage);

      const htmlPath = pathJoin(context.extensionPath, 'media', 'webview.html');

      const html = await readFile(htmlPath, 'utf8');

      const stylePath = pathJoin(context.extensionPath, 'media', 'style.css');
      const scriptPath = pathJoin(context.extensionPath, 'media', 'script.js');

      const styleUri = currentPanel.webview.asWebviewUri(Uri.file(stylePath));
      const scriptUri = currentPanel.webview.asWebviewUri(Uri.file(scriptPath));

      setWebviewInitialContent(html, scriptUri, styleUri);
    }
  }

  function setWebviewInitialContent(html: string, scriptUri: Uri, styleUri: Uri): void {
    if (currentPanel && !currentPanelDisposed) {
      const nonce = getNonce(); // Content Security Policy (CSP)

      currentPanel.webview.html = html
        .replace(
          '<meta http-equiv="Content-Security-Policy" />',
          `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${currentPanel.webview.cspSource}; script-src 'nonce-${nonce}';" />`
        )
        .replace(
          '<script src="script.js"></script>',
          `<script nonce="${nonce}" src="${scriptUri.toString()}"></script>`
        )
        .replace(
          '<link href="style.css" rel="stylesheet" />',
          `<link href="${styleUri.toString()}" rel="stylesheet" />`
        );
    }
  }

  async function postWorkspacesToWebview(workspaces: Array<WorkspaceInfo>): Promise<void> {
    if (currentPanel && !currentPanelDisposed) {
      currentPanel.webview.postMessage({ command: 'set-workspaces', workspaces });
    }
  }

  function postStorageSizeToWebview(name: string, size: number): void {
    if (currentPanel && !currentPanelDisposed) {
      currentPanel.webview.postMessage({ command: 'set-storage-size', name, size });
    }
  }

  function postWorkspaceSizeToWebview(name: string, size: number): void {
    if (currentPanel && !currentPanelDisposed) {
      currentPanel.webview.postMessage({ command: 'set-workspace-size', name, size });
    }
  }
}

export function deactivate() {} // eslint-disable-line @typescript-eslint/no-empty-function

function getNonce(): string {
  const characters: Array<string> = [];

  for (let i = 0; i < 32; i++) {
    characters.push(nonceCharacters.charAt(Math.floor(Math.random() * nonceCharacters.length)));
  }

  return characters.join('');
}

async function getWorkspacesAsync(workspaceStorageRootPath: string): Promise<Array<WorkspaceInfo>> {
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
      name: dir,
      note: `No workspace.json under ${workspaceStoragePath}`
    };
  }

  const fileContent = await readFile(workspaceInfoFilePath, 'utf8');

  const workspaceInfo = JSON.parse(fileContent);

  if (workspaceInfo.workspace) {
    const workspaceFileUri = Uri.parse(workspaceInfo.workspace);

    if (!workspaceFileUri) {
      return {
        name: dir,
        note: `Invalid workspace file URI (${workspaceInfo.workspace}) in ${workspaceInfoFilePath}`
      };
    }

    if (workspaceFileUri.scheme === 'file') {
      const workspaceFile = workspaceFileUri.fsPath;

      if (workspaceFile) {
        return {
          name: dir,
          path: workspaceFile,
          pathExists: existsSync(workspaceFile)
        };
      }
    }

    const workspaceUrl = workspaceFileUri.toString();

    return {
      name: dir,
      url: workspaceUrl
    };
  }

  if (workspaceInfo.folder) {
    const workspacePathUri = Uri.parse(workspaceInfo.folder);

    if (!workspacePathUri) {
      return {
        name: dir,
        note: `Invalid workspace folder URI (${workspaceInfo.folder}) in ${workspaceInfoFilePath}`
      };
    }

    if (workspacePathUri.scheme === 'file') {
      const workspacePath = workspacePathUri.fsPath;

      if (workspacePath) {
        return {
          name: dir,
          path: workspacePath,
          pathExists: existsSync(workspacePath)
        };
      }
    }

    const workspaceUrl = workspacePathUri.toString();

    return {
      name: dir,
      url: workspaceUrl
    };
  }

  return {
    name: dir,
    note: `No workspace folder or file URI in ${workspaceInfoFilePath}`
  };
}

function sortWorkspaceInfoArray(first: WorkspaceInfo, second: WorkspaceInfo): number {
  const firstValue = first.path ?? first.url ?? first.note ?? '';
  const secondValue = second.path ?? second.url ?? second.note ?? '';

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

async function getDirSizeAsync(dirPath: string): Promise<number> {
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
