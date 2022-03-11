import {
  existsSync,
  readdirSync,
  readFileSync,
  rmdirSync
} from 'fs';

import {
  dirname,
  join as joinPath,
} from 'path';

import {
  commands,
  window,
  ExtensionContext,
  Uri,
  ViewColumn
} from 'vscode';

interface IWorkspaceInfo {
  name: string;
  path?: string;
  pathExists?: boolean;
  url?: string;
  note?: string;
}

export function activate(context: ExtensionContext) {
  context.subscriptions.push(
    commands.registerCommand(
      'workspace-storage-cleanup.run',
      () => {
        const globalStoragePath = dirname(context.globalStorageUri.fsPath);

        if (!globalStoragePath || !existsSync(globalStoragePath)) {
          window.showErrorMessage('Could not find global storage path.');

          return;
        }

        const userPath = dirname(globalStoragePath);

        const workspaceStoragePath = joinPath(userPath, 'workspaceStorage');

        const workspaces = getWorkspaces(workspaceStoragePath);

        const panel =
          window.createWebviewPanel(
            'workspace-storage-cleanup.run',
            'Workspace Storage',
            ViewColumn.One,
            {
              enableScripts: true
            }
          );

        panel.webview.html = getWebviewContent(workspaces);

        function updateWebview() {
          panel.webview.html = getWebviewContent(getWorkspaces(workspaceStoragePath));
        }

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
          message => {
            if (message.command === 'delete' && message.selectedWorkspaces?.length > 0) {
              const errorMessages: string[] = [];

              for (const workspace of message.selectedWorkspaces) {
                const dirPath = joinPath(workspaceStoragePath, workspace);

                try {
                  rmdirSync(dirPath, { recursive: true });
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

              updateWebview();
            }
          },
          void 0,
          context.subscriptions
        );
      }
    )
  )
}

export function deactivate() { } // eslint-disable-line @typescript-eslint/no-empty-function

function getWorkspaces(workspaceStoragePath: string): IWorkspaceInfo[] {
  const directories =
    readdirSync(workspaceStoragePath, { withFileTypes: true })
      .filter(dir => dir.isDirectory())
      .map(dir => dir.name);

  const workspaces: IWorkspaceInfo[] = [];

  for (const dir of directories) {
    const dirPath = joinPath(workspaceStoragePath, dir);

    const workspaceInfoPath = joinPath(dirPath, 'workspace.json');

    if (!existsSync(workspaceInfoPath)) {
      workspaces.push({
        name: dir,
        note: `No workspace.json under ${dirPath}`
      });

      continue;
    }

    const workspaceInfo = JSON.parse(readFileSync(workspaceInfoPath, 'utf8'));

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
          workspaces.push({
            name: dir,
            path: workspacePath,
            pathExists: existsSync(workspacePath)
          });

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

function sortWorkspaceInfoArray(first: IWorkspaceInfo, second: IWorkspaceInfo): number {
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

function getWebviewContent(workspaces: IWorkspaceInfo[]) {
  const rows: string[] = [];

  for (const workspace of workspaces) {
    if (workspace.path) {
      const icon = !workspace.pathExists ? ' ❌' : '';

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
    else if (workspace.url) {
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
    else {
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
    <br />
    <br />
    <table border="1" cellspacing="0" cellpadding="5" width="100%">
      <thead>
        <tr>
          <th></th>
          <th>Name</th>
          <th>Path / URL</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${rows.join('\n')}
        <tr>
          <td></td>
          <td colspan="3">${workspaces.length} item(s) listed.</td>
        </tr>
      </tbody>
    </table>

    <br />

    <button onclick="onDeleteSelected()">Delete</button>

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

      function onToggleAll() {
        const allElements = document.querySelectorAll('input[type="checkbox"].check');
        const selectedElements = document.querySelectorAll('input[type="checkbox"].check:checked');

        allElements.length === selectedElements.length
          ? document
            .querySelectorAll('input[type="checkbox"].check')
            .forEach(e => e.checked = false)
          : document
            .querySelectorAll('input[type="checkbox"].check')
            .forEach(e => e.checked = true);
      }

      function onToggleFolderMissing() {
        document
          .querySelectorAll('input[type="checkbox"].check.folder-missing')
          .forEach(e => e.checked = !e.checked);
      }

      function onToggleRemote() {
        document
          .querySelectorAll('input[type="checkbox"].check.remote')
          .forEach(e => e.checked = !e.checked);
      }

      function onToggleBroken() {
        document
          .querySelectorAll('input[type="checkbox"].check.broken')
          .forEach(e => e.checked = !e.checked);
      }

      function onInvertSelection() {
        document
          .querySelectorAll('input[type="checkbox"].check')
          .forEach(e => e.checked = !e.checked);
      }
    </script>
</body>
</html>`;
}
