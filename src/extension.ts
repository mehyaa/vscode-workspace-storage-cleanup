import { existsSync } from 'fs';

import { readFile, rmdir } from 'fs/promises';

import { dirname, join as pathJoin } from 'path';

import { commands, env, window, Uri, ViewColumn, ProgressLocation } from 'vscode';

import { getDirSizeAsync, getNonce } from './utils';

import { getWorkspacesAsync } from './workspace';

import type { ExtensionContext, WebviewPanel } from 'vscode';

import type { WorkspaceInfo } from './workspace';

type PathWithSize = {
  path: string;
  size: number;
};

type WebviewMessage =
  | {
      command: 'refresh';
    }
  | {
      command: 'delete';
      workspaces?: Array<string>;
    }
  | {
      command: 'get-storage-size';
      name?: string;
    }
  | {
      command: 'get-workspace-size';
      name?: string;
    }
  | {
      command: 'get-all-storage-sizes';
    }
  | {
      command: 'get-all-workspace-sizes';
    }
  | {
      command: 'browse-folder';
      name?: string;
      path?: string;
    }
  | {
      command: 'open-file';
      path?: string;
    };

export function activate(context: ExtensionContext) {
  let currentPanel: WebviewPanel | undefined = undefined;

  let workspaces: Array<WorkspaceInfo> = [];

  function getWorkspaceStorageRootPath(context: ExtensionContext): string | undefined {
    const globalStoragePath = dirname(context.globalStorageUri.fsPath);

    if (!globalStoragePath) {
      window.showErrorMessage('Could not get global storage path');

      return;
    }

    const vscodeProfilePath = dirname(globalStoragePath);

    return pathJoin(vscodeProfilePath, 'workspaceStorage');
  }

  const workspaceStorageRootPath = getWorkspaceStorageRootPath(context);

  if (!workspaceStorageRootPath) {
    window.showErrorMessage('Could not get workspace storage root path. Extension will not register commands.');

    return;
  }

  context.subscriptions.push(
    commands.registerCommand('workspace-storage-cleanup.show', () => showWorkspacePanelAsync(context)),

    commands.registerCommand('workspace-storage-cleanup.run-folder-missing', () =>
      removeMatchingWorkspaces(w => w.folder && !w.folder.exists, 'Removing workspaces with missing folders...')
    ),

    commands.registerCommand('workspace-storage-cleanup.run-broken', () =>
      removeMatchingWorkspaces(w => w.type === 'error', 'Removing workspaces with errors...')
    ),

    commands.registerCommand('workspace-storage-cleanup.run-empty', () =>
      removeMatchingWorkspaces(
        w => w.workspace && w.workspace.folders.length === 0,
        'Removing workspaces with empty folders...'
      )
    ),

    commands.registerCommand('workspace-storage-cleanup.run-remote', () =>
      removeMatchingWorkspaces(w => w.type === 'remote', 'Removing remote workspaces...')
    )
  );

  async function showWorkspacePanelAsync(context: ExtensionContext): Promise<void> {
    async function handleWebviewMessage(message: WebviewMessage): Promise<void> {
      switch (message.command) {
        case 'refresh':
          {
            workspaces = await getWorkspacesAsync(workspaceStorageRootPath!);

            await postWorkspacesToWebview(workspaces);
          }

          break;

        case 'delete':
          if (message.workspaces && message.workspaces.length > 0) {
            await window.withProgress(
              {
                location: ProgressLocation.Notification,
                title: 'Deleting selected workspaces...',
                cancellable: false
              },
              async () => {
                const errorMessages: Array<string> = [];

                if (!message.workspaces || message.workspaces.length === 0) {
                  return;
                }

                for (const workspace of message.workspaces) {
                  const dirPath = pathJoin(workspaceStorageRootPath!, workspace);

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

                workspaces = await getWorkspacesAsync(workspaceStorageRootPath!);

                await postWorkspacesToWebview(workspaces);
              }
            );
          }

          break;

        case 'get-storage-size':
          {
            if (!message.name) {
              return;
            }

            const workspace = workspaces.find(w => w.name === message.name);

            if (workspace) {
              try {
                const workspaceStoragePath = pathJoin(workspaceStorageRootPath!, workspace.name);

                const storageSize = await getDirSizeAsync(workspaceStoragePath);

                postStorageSizeToWebview(workspace.name, storageSize);
              } catch (err) {
                window.showErrorMessage(`Failed to get storage size for ${workspace.name}: ${(err as Error)?.message}`);
              }
            }
          }

          break;

        case 'get-workspace-size':
          {
            if (!message.name) {
              return;
            }

            const workspace = workspaces.find(w => w.name === message.name);

            if (workspace) {
              await calculateAndWorkspaceSizeToWebviewAsync(workspace);
            }
          }

          break;

        case 'get-all-storage-sizes':
          {
            for (const workspace of workspaces) {
              try {
                const workspaceStoragePath = pathJoin(workspaceStorageRootPath!, workspace.name);

                const storageSize = await getDirSizeAsync(workspaceStoragePath);

                postStorageSizeToWebview(workspace.name, storageSize);
              } catch (err) {
                window.showErrorMessage(`Failed to get storage size for ${workspace.name}: ${(err as Error)?.message}`);
              }
            }
          }

          break;

        case 'get-all-workspace-sizes':
          {
            for (const workspace of workspaces) {
              await calculateAndWorkspaceSizeToWebviewAsync(workspace);
            }
          }

          break;

        case 'browse-folder':
          {
            if (!message.name && !message.path) {
              return;
            }

            const folderPath = message.path ? message.path : pathJoin(workspaceStorageRootPath!, message.name!);

            if (existsSync(folderPath)) {
              const success = await env.openExternal(Uri.file(folderPath));

              if (!success) {
                window.showErrorMessage(`Could not open folder '${folderPath}'`);
              }
            } else {
              window.showErrorMessage(`Folder '${folderPath}' does not exist`);
            }
          }

          break;

        case 'open-file':
          {
            if (!message.path) {
              return;
            }

            if (existsSync(message.path)) {
              const success = await commands.executeCommand('vscode.open', Uri.file(message.path));

              if (!success) {
                window.showErrorMessage(`Could not open file '${message.path}'`);
              }
            } else {
              window.showErrorMessage(`File '${message.path}' does not exist`);
            }
          }

          break;
      }
    }

    async function calculateAndWorkspaceSizeToWebviewAsync(workspace: WorkspaceInfo): Promise<void> {
      if (workspace.folder && existsSync(workspace.folder.path)) {
        try {
          const workspaceSize = await getDirSizeAsync(workspace.folder.path);
          postWorkspaceSizeToWebview(workspace.name, workspaceSize);
        } catch (err) {
          window.showErrorMessage(
            `Failed to get size of folder ${workspace.folder.path} for workspace ${workspace.name}: ${
              (err as Error)?.message
            }`
          );
        }
      } else if (workspace.workspace && workspace.workspace.folders.length > 0) {
        const workspaceSizes: Array<PathWithSize> = await Promise.all(
          workspace.workspace.folders
            .filter(folder => existsSync(folder.path))
            .map(async folder => {
              try {
                const size = await getDirSizeAsync(folder.path);
                return { path: folder.path, size };
              } catch (err) {
                window.showErrorMessage(
                  `Failed to get size of folder ${folder.path} for workspace ${workspace.name}: ${
                    (err as Error)?.message
                  }`
                );
                return { path: folder.path, size: 0 };
              }
            })
        );

        postWorkspaceSizesToWebview(workspace.name, workspaceSizes);
      }
    }

    await initializeWebviewAsync(context, handleWebviewMessage);
  }

  async function initializeWebviewAsync(
    context: ExtensionContext,
    handleWebviewMessage: (message: WebviewMessage) => Promise<void>
  ): Promise<void> {
    if (currentPanel) {
      try {
        currentPanel.reveal(ViewColumn.One, false);
      } catch (err) {
        window.showErrorMessage(`Failed to reveal webview panel: ${(err as Error)?.message}`);
      }
    } else {
      try {
        currentPanel = window.createWebviewPanel(
          'workspace-storage-cleanup',
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

        currentPanel.onDidDispose(
          () => {
            currentPanel = undefined;
          },
          null,
          context.subscriptions
        );

        currentPanel.webview.onDidReceiveMessage(handleWebviewMessage);

        const htmlPath = pathJoin(context.extensionPath, 'media', 'webview.html');

        const html = await readFile(htmlPath, 'utf8');

        const stylePath = pathJoin(context.extensionPath, 'media', 'style.css');
        const scriptPath = pathJoin(context.extensionPath, 'media', 'script.js');

        const styleUri = currentPanel.webview.asWebviewUri(Uri.file(stylePath));
        const scriptUri = currentPanel.webview.asWebviewUri(Uri.file(scriptPath));

        setWebviewInitialContent(html, scriptUri, styleUri);
      } catch (err) {
        window.showErrorMessage(`Failed to initialize webview: ${(err as Error)?.message}`);
      }
    }
  }

  function setWebviewInitialContent(html: string, scriptUri: Uri, styleUri: Uri): void {
    if (currentPanel) {
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
    if (currentPanel) {
      try {
        currentPanel.webview.postMessage({ command: 'set-workspaces', workspaces });
      } catch (err) {
        window.showErrorMessage(`Failed to post workspaces to webview: ${(err as Error)?.message}`);
      }
    }
  }

  function postStorageSizeToWebview(name: string, size: number): void {
    if (currentPanel) {
      try {
        currentPanel.webview.postMessage({ command: 'set-storage-size', name, size });
      } catch (err) {
        window.showErrorMessage(`Failed to post storage size to webview: ${(err as Error)?.message}`);
      }
    }
  }

  function postWorkspaceSizeToWebview(name: string, size: number): void {
    if (currentPanel) {
      try {
        currentPanel.webview.postMessage({ command: 'set-workspace-size', name, size });
      } catch (err) {
        window.showErrorMessage(`Failed to post workspace size to webview: ${(err as Error)?.message}`);
      }
    }
  }

  function postWorkspaceSizesToWebview(name: string, sizes: Array<PathWithSize>): void {
    if (currentPanel) {
      try {
        currentPanel.webview.postMessage({ command: 'set-workspace-sizes', name, sizes });
      } catch (err) {
        window.showErrorMessage(`Failed to post workspace sizes to webview: ${(err as Error)?.message}`);
      }
    }
  }

  async function removeMatchingWorkspaces(predicate: (w: WorkspaceInfo) => boolean | undefined, message: string) {
    return window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: message,
        cancellable: false
      },
      async () => {
        workspaces = await getWorkspacesAsync(workspaceStorageRootPath!);

        for (const workspace of workspaces) {
          if (predicate(workspace)) {
            try {
              await rmdir(pathJoin(workspaceStorageRootPath!, workspace.name), { recursive: true });
            } catch (err) {
              window.showErrorMessage(
                `Failed to remove workspace folder ${workspace.name}: ${(err as Error)?.message}`
              );
            }
          }
        }

        if (currentPanel) {
          workspaces = await getWorkspacesAsync(workspaceStorageRootPath!);

          await postWorkspacesToWebview(workspaces);
        }
      }
    );
  }
}

export function deactivate() {} // eslint-disable-line @typescript-eslint/no-empty-function