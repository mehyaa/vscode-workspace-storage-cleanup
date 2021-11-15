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
}

export function activate(context: ExtensionContext) {
  context.subscriptions.push(
    commands.registerCommand(
      'workspace-storage-cleanup.run',
      getRunCommandHandler(context)
    )
  )
}

export function deactivate() { } // eslint-disable-line @typescript-eslint/no-empty-function

function getRunCommandHandler(context: ExtensionContext) {
  return () => {
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
}

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
      continue;
    }

    const workspaceInfo = JSON.parse(readFileSync(workspaceInfoPath, 'utf8'));

    if (!workspaceInfo.folder) {
      continue;
    }

    const workspacePathUri = Uri.parse(workspaceInfo.folder);

    if (!workspacePathUri) {
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
      } else {
        const workspaceUrl = workspacePathUri.toString();

        workspaces.push({
          name: dir,
          url: workspaceUrl
        });
      }
    }
    else {
      const workspaceUrl = workspacePathUri.toString();

      workspaces.push({
        name: dir,
        url: workspaceUrl
      });
    }
  }

  workspaces.sort(
    (a: IWorkspaceInfo, b: IWorkspaceInfo) =>
      ((a.path ?? a.url ?? '') > (b.path ?? b.url ?? ''))
        ? 1
        : (((b.path ?? b.url ?? '') > (a.path ?? a.url ?? ''))
          ? -1
          : 0));

  return workspaces;
}

function getWebviewContent(workspaces: IWorkspaceInfo[]) {
  const tbody =
    workspaces
      .map(w =>
        w.url
          ? `
        <tr>
          <td><input class="check" type="checkbox" value="${w.name}"></td>
          <td>${w.name}</td>
          <td colspan="2">${w.url}</td>
        </tr>`
          : `
        <tr>
          <td><input class="check" type="checkbox" value="${w.name}"></td>
          <td>${w.name}</td>
          <td>${w.path}</td>
          <td>${w.pathExists === true ? '✔️' : '❌'}</td>
        </tr>`)
      .join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Workspace Storage</title>
</head>
<body>
    <table border="1" cellspacing="0" cellpadding="5" width="100%">
      <thead>
        <tr>
          <th></th>
          <th>Name</th>
          <th>Path / URL</th>
          <th>Path Exists</th>
        </tr>
      </thead>
      <tbody>
        ${tbody}
      </tbody>
    </table>

    <br />

    <button onclick="onDelete()">Delete</button>

    <script>
      vscode = acquireVsCodeApi();

      function onDelete() {
        const selectedWorkspaces =
          Array.prototype.map.call(
            document.querySelectorAll(
              'input.check[type="checkbox"]:checked'),
            e => e.value);

        vscode.postMessage({
          command: 'delete',
          selectedWorkspaces: selectedWorkspaces
        })
      }
    </script>
</body>
</html>`;
}
