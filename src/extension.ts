import { Dirent, existsSync } from 'fs';

import { readdir, readFile, rmdir, stat } from 'fs/promises';

import { dirname, join as pathJoin } from 'path';

import { commands, window, ExtensionContext, Uri, ViewColumn, WebviewPanel } from 'vscode';

type WorkspaceInfo = {
  name: string;
  path?: string;
  pathExists?: boolean;
  url?: string;
  note?: string;
  workspaceSize?: number;
  storageSize?: number;
};

type WebviewMessage = {
  command: string;
  selectedWorkspaces?: Array<string>;
};

let currentPanel: WebviewPanel | undefined = undefined;
let currentPanelDisposed: boolean = false;

export function activate(context: ExtensionContext) {
  context.subscriptions.push(
    commands.registerCommand('workspace-storage-cleanup.run', () => showWorkspacePanelAsync(context))
  );
}

export function deactivate() {} // eslint-disable-line @typescript-eslint/no-empty-function

async function showWorkspacePanelAsync(context: ExtensionContext): Promise<void> {
  const globalStoragePath = dirname(context.globalStorageUri.fsPath);

  if (!globalStoragePath) {
    window.showErrorMessage('Could not get global storage path.');

    return;
  }

  const showSizesString = await window.showQuickPick(['Yes', 'No'], {
    placeHolder: 'Show folder sizes?'
  });

  const showSizes = showSizesString === 'Yes';

  const vscodeProfilePath = dirname(globalStoragePath);

  const workspaceStoragePath = pathJoin(vscodeProfilePath, 'workspaceStorage');

  async function handleWebviewMessage(message: WebviewMessage): Promise<void> {
    switch (message.command) {
      case 'refresh':
        {
          showLoadingOnWebview();

          const workspaces = await getWorkspacesAsync(workspaceStoragePath, showSizes);

          await updateWebviewAsync(workspaces, showSizes);
        }

        break;

      case 'delete':
        if (message.selectedWorkspaces && message.selectedWorkspaces.length > 0) {
          const errorMessages: Array<string> = [];

          for (const workspace of message.selectedWorkspaces) {
            const dirPath = pathJoin(workspaceStoragePath, workspace);

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

          showLoadingOnWebview();

          const workspaces = await getWorkspacesAsync(workspaceStoragePath, showSizes);

          await updateWebviewAsync(workspaces, showSizes);
        }

        break;
    }
  }

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
        enableScripts: true
      }
    );

    context.subscriptions.push(currentPanel);

    currentPanel.onDidDispose(() => (currentPanelDisposed = true));

    currentPanel.webview.onDidReceiveMessage(handleWebviewMessage);
  }

  showLoadingOnWebview();

  const workspaces = await getWorkspacesAsync(workspaceStoragePath, showSizes);

  await updateWebviewAsync(workspaces, showSizes);
}

async function updateWebviewAsync(workspaces: Array<WorkspaceInfo>, showSizes: boolean): Promise<void> {
  if (currentPanel && !currentPanelDisposed) {
    currentPanel.webview.html = getWorkspaceInfoWebviewContent(workspaces, showSizes);
  }
}

function showLoadingOnWebview(): void {
  if (currentPanel && !currentPanelDisposed) {
    currentPanel.webview.html = getLoadingWebviewContent();
  }
}

async function getWorkspacesAsync(workspaceStoragePath: string, includeSizes: boolean): Promise<Array<WorkspaceInfo>> {
  const directories = (await readdir(workspaceStoragePath, { withFileTypes: true }))
    .filter(dir => dir.isDirectory())
    .map(dir => dir.name);

  const workspaces: Array<WorkspaceInfo> = [];

  for (const dir of directories) {
    const dirPath = pathJoin(workspaceStoragePath, dir);

    const workspaceInfoPath = pathJoin(dirPath, 'workspace.json');

    if (!existsSync(workspaceInfoPath)) {
      workspaces.push({
        name: dir,
        note: `No workspace.json under ${dirPath}`
      });

      continue;
    }

    const fileContent = await readFile(workspaceInfoPath, 'utf8');

    const workspaceInfo = JSON.parse(fileContent);

    if (workspaceInfo.workspace) {
      const workspaceFileUri = Uri.parse(workspaceInfo.workspace);

      if (!workspaceFileUri) {
        workspaces.push({
          name: dir,
          note: `Invalid workspace file URI (${workspaceInfo.workspace}) in ${workspaceInfoPath}`
        });

        continue;
      }

      if (workspaceFileUri.scheme === 'file') {
        const workspaceFile = workspaceFileUri.fsPath;

        if (workspaceFile) {
          workspaces.push({
            name: dir,
            path: workspaceFile,
            pathExists: existsSync(workspaceFile)
          });

          continue;
        }
      }

      const workspaceUrl = workspaceFileUri.toString();

      workspaces.push({
        name: dir,
        url: workspaceUrl
      });

      continue;
    }

    if (workspaceInfo.folder) {
      const workspacePathUri = Uri.parse(workspaceInfo.folder);

      if (!workspacePathUri) {
        workspaces.push({
          name: dir,
          note: `Invalid workspace folder URI (${workspaceInfo.folder}) in ${workspaceInfoPath}`
        });

        continue;
      }

      if (workspacePathUri.scheme === 'file') {
        const workspacePath = workspacePathUri.fsPath;

        if (workspacePath) {
          const workspace: WorkspaceInfo = {
            name: dir,
            path: workspacePath,
            pathExists: existsSync(workspacePath)
          };

          if (includeSizes) {
            if (workspace.pathExists) {
              workspace.workspaceSize = await getDirSizeAsync(workspacePath);
            }

            workspace.storageSize = await getDirSizeAsync(dirPath);
          }

          workspaces.push(workspace);

          continue;
        }
      }

      const workspaceUrl = workspacePathUri.toString();

      workspaces.push({
        name: dir,
        url: workspaceUrl
      });

      continue;
    }

    workspaces.push({
      name: dir,
      note: `No workspace folder or file URI in ${workspaceInfoPath}`
    });
  }

  workspaces.sort(sortWorkspaceInfoArray);

  return workspaces;
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

function humanFileSize(size: number | undefined): string {
  size = size ?? 0;

  const i = size === 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024));

  return `${(size / Math.pow(1024, i)).toFixed(2)} ${['B', 'kB', 'MB', 'GB', 'TB'][i]}`;
}

function getWorkspaceInfoWebviewContent(workspaces: Array<WorkspaceInfo>, includeSizes: boolean) {
  const cols: Array<string> = [];
  const headers: Array<string> = [];
  const rows: Array<string> = [];

  cols.push('<col>');
  cols.push('<col>');

  headers.push('<th></th>');
  headers.push('<th>Name</th>');

  if (includeSizes) {
    cols.push('<col align="right">');

    headers.push('<th>Storage Size</th>');
  }

  headers.push('<th>Path / URL</th>');

  if (includeSizes) {
    cols.push('<col align="right">');

    headers.push('<th>Workspace Size</th>');
  }

  cols.push('<col>');

  headers.push('<th></th>');

  for (const workspace of workspaces) {
    if (workspace.path) {
      const icon = !workspace.pathExists ? ' ❌' : '';

      if (includeSizes) {
        rows.push(`
          <tr>
            <td><input class="check ${icon ? 'folder-missing' : ''}" type="checkbox" value="${workspace.name}"></td>
            <td>${workspace.name}</td>
            <td>${humanFileSize(workspace.storageSize)}</td>
            <td>${workspace.path}${icon}</td>
            <td>${workspace.workspaceSize ? humanFileSize(workspace.workspaceSize) : '-'}</td>
            <td>
              <a href="javascript:;" onclick="onDelete('${workspace.name}')">Delete</a>
            </td>
          </tr>`);
      } else {
        rows.push(`
          <tr>
            <td><input class="check ${icon ? 'folder-missing' : ''}" type="checkbox" value="${workspace.name}"></td>
            <td>${workspace.name}</td>
            <td>${workspace.path}${icon}</td>
            <td>
              <a href="javascript:;" onclick="onDelete('${workspace.name}')">Delete</a>
            </td>
          </tr>`);
      }
    } else if (workspace.url) {
      if (includeSizes) {
        rows.push(`
          <tr>
            <td><input class="check remote" type="checkbox" value="${workspace.name}"></td>
            <td>${workspace.name}</td>
            <td>${humanFileSize(workspace.storageSize)}</td>
            <td>${workspace.url}</td>
            <td>${workspace.workspaceSize ? humanFileSize(workspace.workspaceSize) : '-'}</td>
            <td>
              <a href="javascript:;" onclick="onDelete('${workspace.name}')">Delete</a>
            </td>
          </tr>`);
      } else {
        rows.push(`
          <tr>
            <td><input class="check remote" type="checkbox" value="${workspace.name}"></td>
            <td>${workspace.name}</td>
            <td>${workspace.url}</td>
            <td>
              <a href="javascript:;" onclick="onDelete('${workspace.name}')">Delete</a>
            </td>
          </tr>`);
      }
    } else {
      if (includeSizes) {
        rows.push(`
          <tr>
            <td><input class="check broken" type="checkbox" value="${workspace.name}"></td>
            <td>${workspace.name}</td>
            <td>${humanFileSize(workspace.storageSize)}</td>
            <td>${workspace.note}</td>
            <td>${workspace.workspaceSize ? humanFileSize(workspace.workspaceSize) : '-'}</td>
            <td>
              <a href="javascript:;" onclick="onDelete('${workspace.name}')">Delete</a>
            </td>
          </tr>`);
      } else {
        rows.push(`
          <tr>
            <td><input class="check broken" type="checkbox" value="${workspace.name}"></td>
            <td>${workspace.name}</td>
            <td>${workspace.note}</td>
            <td>
              <a href="javascript:;" onclick="onDelete('${workspace.name}')">Delete</a>
            </td>
          </tr>`);
      }
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Workspace Storage</title>
</head>
<body>
    <br />
    <button onclick="onToggleAll()">Toggle all</button>
    <button onclick="onToggleFolderMissing()">Toggle folder missing</button>
    <button onclick="onToggleRemote()">Toggle remote</button>
    <button onclick="onToggleBroken()">Toggle broken</button>
    <button onclick="onInvertSelection()">Invert selection</button>
    <button onclick="onRefresh()">Refresh List</button>
    <br />
    <br />
    <table border="1" cellspacing="0" cellpadding="5" width="100%">
      <colgroup>
        ${cols.join('\n')}
      </colgroup>
      <thead>
        <tr>
          ${headers.join('\n')}
        </tr>
      </thead>
      <tbody>
        ${rows.join('\n')}
      </tbody>
      <tfoot>
        <tr>
          <td></td>
          <td colspan="${includeSizes ? '5' : '3'}">${workspaces.length} item${
    workspaces.length > 1 ? '(s)' : ''
  } listed.</td>
        </tr>
      </tfoot>
    </table>

    <br />

    <button onclick="onDeleteSelected()">Delete Selected</button>

    <script>
      var vscode = acquireVsCodeApi();

      function onDelete(workspace) {
        vscode.postMessage({
          command: 'delete',
          selectedWorkspaces: [workspace]
        });
      }

      function onDeleteSelected() {
        const selectedElements = document.querySelectorAll('input[type="checkbox"].check:checked');
        const selectedWorkspaces = Array.prototype.map.call(selectedElements, e => e.value);

        vscode.postMessage({
          command: 'delete',
          selectedWorkspaces: selectedWorkspaces
        });
      }

      function onToggleCheckboxes(selector) {
        const allElements = document.querySelectorAll(selector);
        const selectedElements = document.querySelectorAll(selector + ':checked');

        allElements.length === selectedElements.length
          ? document
              .querySelectorAll(selector)
              .forEach(e => e.checked = false)
          : document
              .querySelectorAll(selector)
              .forEach(e => e.checked = true);
      }

      function onToggleAll() {
        onToggleCheckboxes('input[type="checkbox"].check');
      }

      function onToggleFolderMissing() {
        onToggleCheckboxes('input[type="checkbox"].check.folder-missing');
      }

      function onToggleRemote() {
        onToggleCheckboxes('input[type="checkbox"].check.remote');
      }

      function onToggleBroken() {
        onToggleCheckboxes('input[type="checkbox"].check.broken');
      }

      function onInvertSelection() {
        document
          .querySelectorAll('input[type="checkbox"].check')
          .forEach(e => e.checked = !e.checked);
      }

      function onRefresh() {
        vscode.postMessage({
          command: 'refresh'
        });
      }
    </script>
</body>
</html>`;
}

function getLoadingWebviewContent() : string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Workspace Storage</title>
    <style>
        body,
        html {
            height: 100%;
            margin: 0;
            font-family: Arial, sans-serif;
        }

        #loading {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100%;
        }

        .spinner {
            width: 200px;
            height: 200px;
        }

        .spinner rect {
            fill: #006ead;
        }
    </style>
</head>
<body>
    <div id="loading">
        <svg class="spinner" width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <style>
                .spinner_LWk7 {
                    animation: spinner_GWy6 1.2s linear infinite, spinner_BNNO 1.2s linear infinite
                }

                .spinner_yOMU {
                    animation: spinner_GWy6 1.2s linear infinite, spinner_pVqn 1.2s linear infinite;
                    animation-delay: .15s
                }

                .spinner_KS4S {
                    animation: spinner_GWy6 1.2s linear infinite, spinner_6uKB 1.2s linear infinite;
                    animation-delay: .3s
                }

                .spinner_zVee {
                    animation: spinner_GWy6 1.2s linear infinite, spinner_Qw4x 1.2s linear infinite;
                    animation-delay: .45s
                }

                @keyframes spinner_GWy6 {
                    0%,
                    50% {
                        width: 9px;
                        height: 9px
                    }
                    10% {
                        width: 11px;
                        height: 11px
                    }
                }

                @keyframes spinner_BNNO {
                    0%,
                    50% {
                        x: 1.5px;
                        y: 1.5px
                    }
                    10% {
                        x: .5px;
                        y: .5px
                    }
                }

                @keyframes spinner_pVqn {
                    0%,
                    50% {
                        x: 13.5px;
                        y: 1.5px
                    }
                    10% {
                        x: 12.5px;
                        y: .5px
                    }
                }

                @keyframes spinner_6uKB {
                    0%,
                    50% {
                        x: 13.5px;
                        y: 13.5px
                    }
                    10% {
                        x: 12.5px;
                        y: 12.5px
                    }
                }

                @keyframes spinner_Qw4x {
                    0%,
                    50% {
                        x: 1.5px;
                        y: 13.5px
                    }
                    10% {
                        x: .5px;
                        y: 12.5px
                    }
                }
            </style>
            <rect class="spinner_LWk7" x="1.5" y="1.5" rx="1" width="9" height="9" />
            <rect class="spinner_yOMU" x="13.5" y="1.5" rx="1" width="9" height="9" />
            <rect class="spinner_KS4S" x="13.5" y="13.5" rx="1" width="9" height="9" />
            <rect class="spinner_zVee" x="1.5" y="13.5" rx="1" width="9" height="9" />
        </svg>
    </div>
</body>
</html>`;

}