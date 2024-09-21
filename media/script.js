const spinnerSvg =
  '<svg class="spinner" width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M10.14,1.16a11,11,0,0,0-9,8.92A1.59,1.59,0,0,0,2.46,12,1.52,1.52,0,0,0,4.11,10.7a8,8,0,0,1,6.66-6.61A1.42,1.42,0,0,0,12,2.69h0A1.57,1.57,0,0,0,10.14,1.16Z" />' +
  '</svg>';

const vscode = acquireVsCodeApi();

function humanFileSize(size) {
  size = size ?? 0;

  const i = size === 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024));

  return `${(size / Math.pow(1024, i)).toFixed(2)} ${['B', 'kB', 'MB', 'GB', 'TB'][i]}`;
}

function onDelete(workspace) {
  vscode.postMessage({
    command: 'delete',
    workspaces: [workspace]
  });
}

function onDeleteSelected() {
  const selectedElements = document.querySelectorAll('input[type="checkbox"].check:checked');
  const selectedWorkspaces = Array.prototype.map.call(selectedElements, e => e.value);

  vscode.postMessage({
    command: 'delete',
    workspaces: selectedWorkspaces
  });
}

function onToggleCheckboxes(selector) {
  const allElements = document.querySelectorAll(selector);
  const selectedElements = document.querySelectorAll(selector + ':checked');

  allElements.length === selectedElements.length
    ? document.querySelectorAll(selector).forEach(e => (e.checked = false))
    : document.querySelectorAll(selector).forEach(e => (e.checked = true));
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
  document.querySelectorAll('input[type="checkbox"].check').forEach(e => (e.checked = !e.checked));
}

function onRefresh() {
  vscode.postMessage({
    command: 'refresh'
  });
}

function requestStorageSize(name, cellEl) {
  vscode.postMessage({
    command: 'get-storage-size',
    name: name
  });

  cellEl.innerHTML = spinnerSvg;
}

function requestWorkspaceSize(name, cellEl) {
  vscode.postMessage({
    command: 'get-workspace-size',
    name: name
  });

  cellEl.innerHTML = spinnerSvg;
}

function requestAllStorageSizes() {
  vscode.postMessage({
    command: 'get-all-storage-sizes'
  });

  document.querySelectorAll('table[id="workspaces"] td.storage-size').forEach(e => (e.innerHTML = spinnerSvg));
}

function requestAllWorkspaceSizes() {
  vscode.postMessage({
    command: 'get-all-workspace-sizes'
  });

  document.querySelectorAll('table[id="workspaces"] td.workspace-size').forEach(e => {
    const workspace = currentWorkspaces.find(w => w.name === e.parentElement.id);

    if (workspace && workspace.path) {
      e.innerHTML = spinnerSvg;
    }
  });
}

function setWorkspaces(workspaces) {
  const tableEl = document.querySelector('table[id="workspaces"]');

  const tableBodyEl = tableEl.querySelector('tbody');

  tableBodyEl.innerHTML = '';

  for (const workspace of workspaces) {
    if (workspace.path) {
      const icon = !workspace.pathExists ? ' ❌' : '';

      const rowEl = document.createElement('tr');
      rowEl.id = workspace.name;

      const cellEl = document.createElement('td');
      cellEl.className = 'checkbox';
      const inputEl = document.createElement('input');
      inputEl.className = `check ${icon ? 'folder-missing' : ''}`;
      inputEl.type = 'checkbox';
      inputEl.value = workspace.name;
      cellEl.appendChild(inputEl);
      rowEl.appendChild(cellEl);

      const cellEl2 = document.createElement('td');
      cellEl2.className = 'name';
      cellEl2.textContent = workspace.name;
      rowEl.appendChild(cellEl2);

      const cellEl3 = document.createElement('td');
      cellEl3.className = 'storage-size';
      const aEl = document.createElement('a');
      aEl.className = 'icon';
      aEl.href = 'javascript:';
      aEl.onclick = () => requestStorageSize(workspace.name, cellEl3);
      aEl.textContent = '🔍';
      cellEl3.appendChild(aEl);
      rowEl.appendChild(cellEl3);

      const cellEl4 = document.createElement('td');
      cellEl4.className = 'path';
      cellEl4.textContent = workspace.path + icon;
      rowEl.appendChild(cellEl4);

      const cellEl5 = document.createElement('td');
      cellEl5.className = 'workspace-size';
      const a2El = document.createElement('a');
      a2El.className = 'icon';
      a2El.href = 'javascript:';
      a2El.onclick = () => requestWorkspaceSize(workspace.name, cellEl5);
      a2El.textContent = '🔍';
      cellEl5.appendChild(a2El);
      rowEl.appendChild(cellEl5);

      const cellEl6 = document.createElement('td');
      cellEl6.className = 'actions';
      const a3El = document.createElement('a');
      a3El.href = 'javascript:';
      a3El.onclick = () => onDelete(workspace.name);
      a3El.textContent = 'Delete';
      cellEl6.appendChild(a3El);
      rowEl.appendChild(cellEl6);

      tableBodyEl.appendChild(rowEl);
    } else if (workspace.url) {
      const rowEl = document.createElement('tr');
      rowEl.id = workspace.name;

      const cellEl = document.createElement('td');
      cellEl.className = 'checkbox';
      const inputEl = document.createElement('input');
      inputEl.className = 'check remote';
      inputEl.type = 'checkbox';
      inputEl.value = workspace.name;
      cellEl.appendChild(inputEl);
      rowEl.appendChild(cellEl);

      const cellEl2 = document.createElement('td');
      cellEl2.className = 'name';
      cellEl2.textContent = workspace.name;
      rowEl.appendChild(cellEl2);

      const cellEl3 = document.createElement('td');
      cellEl3.className = 'storage-size';
      const aEl = document.createElement('a');
      aEl.className = 'icon';
      aEl.href = 'javascript:';
      aEl.onclick = () => requestStorageSize(workspace.name, cellEl3);
      aEl.textContent = '🔍';
      cellEl3.appendChild(aEl);
      rowEl.appendChild(cellEl3);

      const cellEl4 = document.createElement('td');
      cellEl4.className = 'path';
      cellEl4.textContent = workspace.url;
      rowEl.appendChild(cellEl4);

      const cellEl5 = document.createElement('td');
      cellEl5.className = 'workspace-size';
      cellEl5.textContent = '-';
      rowEl.appendChild(cellEl5);

      const cellEl6 = document.createElement('td');
      cellEl6.className = 'actions';
      const a2El = document.createElement('a');
      a2El.href = 'javascript:';
      a2El.onclick = () => onDelete(workspace.name);
      a2El.textContent = 'Delete';
      cellEl6.appendChild(a2El);
      rowEl.appendChild(cellEl6);

      tableBodyEl.appendChild(rowEl);
    } else {
      const rowEl = document.createElement('tr');
      rowEl.id = workspace.name;

      const cellEl = document.createElement('td');
      cellEl.className = 'checkbox';
      const inputEl = document.createElement('input');
      inputEl.className = 'check broken';
      inputEl.type = 'checkbox';
      inputEl.value = workspace.name;
      cellEl.appendChild(inputEl);
      rowEl.appendChild(cellEl);

      const cellEl2 = document.createElement('td');
      cellEl2.className = 'name';
      cellEl2.textContent = workspace.name;
      rowEl.appendChild(cellEl2);

      const cellEl3 = document.createElement('td');
      cellEl3.className = 'storage-size';
      const aEl = document.createElement('a');
      aEl.className = 'icon';
      aEl.href = 'javascript:';
      aEl.onclick = () => requestStorageSize(workspace.name, cellEl3);
      aEl.textContent = '🔍';
      cellEl3.appendChild(aEl);
      rowEl.appendChild(cellEl3);

      const cellEl4 = document.createElement('td');
      cellEl4.className = 'path';
      cellEl4.textContent = workspace.note;
      rowEl.appendChild(cellEl4);

      const cellEl5 = document.createElement('td');
      cellEl5.className = 'workspace-size';
      cellEl5.textContent = '-';
      rowEl.appendChild(cellEl5);

      const cellEl6 = document.createElement('td');
      cellEl6.className = 'actions';
      const a2El = document.createElement('a');
      a2El.href = 'javascript:';
      a2El.onclick = () => onDelete(workspace.name);
      a2El.textContent = 'Delete';
      cellEl6.appendChild(a2El);
      rowEl.appendChild(cellEl6);

      tableBodyEl.appendChild(rowEl);
    }
  }

  const loadingEl = document.getElementById('loading');

  if (loadingEl) {
    loadingEl.style.display = 'none';
  }

  const contentEl = document.getElementById('content');

  if (contentEl) {
    contentEl.style.display = 'block';
  }

  document.querySelectorAll('span.workspace-count').forEach(e => (e.textContent = workspaces.length));
}

function setStorageSizeOnTable(name, size) {
  const tableEl = document.querySelector('table[id="workspaces"]');

  if (!tableEl) {
    return;
  }

  const rowEl = tableEl.querySelector(`tr[id="${name}"]`);

  if (!rowEl) {
    return;
  }

  const cellEl = rowEl.querySelector('td.storage-size');

  if (!cellEl) {
    return;
  }

  cellEl.textContent = humanFileSize(size);
}

function setWorkspaceSizeOnTable(name, size) {
  const tableEl = document.querySelector('table[id="workspaces"]');

  if (!tableEl) {
    return;
  }

  const rowEl = tableEl.querySelector(`tr[id="${name}"]`);

  if (!rowEl) {
    return;
  }

  const cellEl = rowEl.querySelector('td.workspace-size');

  if (!cellEl) {
    return;
  }

  cellEl.textContent = size ? humanFileSize(size) : '-';
}

let currentWorkspaces = [];

window.addEventListener('message', event => {
  const message = event.data;

  switch (message.command) {
    case 'set-workspaces':
      {
        currentWorkspaces = message.workspaces ?? [];

        setWorkspaces(currentWorkspaces);
      }

      break;

    case 'set-storage-size':
      {
        const workspace = currentWorkspaces.find(w => w.name === message.name);

        if (workspace) {
          workspace.storageSize = message.size;
        }

        setStorageSizeOnTable(message.name, message.size);
      }

      break;

    case 'set-workspace-size':
      {
        const workspace = currentWorkspaces.find(w => w.name === message.name);

        if (workspace) {
          workspace.workspaceSize = message.size;
        }

        setWorkspaceSizeOnTable(message.name, message.size);
      }

      break;
  }
});

function initializeEvents() {
  const toggleAllEl = document.getElementById('toggle-all');

  if (toggleAllEl) {
    toggleAllEl.onclick = onToggleAll;
  }

  const toggleFolderMissingEl = document.getElementById('toggle-folder-missing');

  if (toggleFolderMissingEl) {
    toggleFolderMissingEl.onclick = onToggleFolderMissing;
  }

  const toggleRemoteEl = document.getElementById('toggle-remote');

  if (toggleRemoteEl) {
    toggleRemoteEl.onclick = onToggleRemote;
  }

  const toggleBrokenEl = document.getElementById('toggle-broken');

  if (toggleBrokenEl) {
    toggleBrokenEl.onclick = onToggleBroken;
  }

  const invertSelectionEl = document.getElementById('invert-selection');

  if (invertSelectionEl) {
    invertSelectionEl.onclick = onInvertSelection;
  }

  const refreshEl = document.getElementById('refresh');

  if (refreshEl) {
    refreshEl.onclick = onRefresh;
  }

  const deleteSelectedEl = document.getElementById('delete-selected');

  if (deleteSelectedEl) {
    deleteSelectedEl.onclick = onDeleteSelected;
  }

  const requestAllStorageSizesEl = document.getElementById('request-all-storage-sizes');

  if (requestAllStorageSizesEl) {
    requestAllStorageSizesEl.onclick = requestAllStorageSizes;
  }

  const requestAllWorkspaceSizesEl = document.getElementById('request-all-workspace-sizes');

  if (requestAllWorkspaceSizesEl) {
    requestAllWorkspaceSizesEl.onclick = requestAllWorkspaceSizes;
  }

  onRefresh();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeEvents);
} else {
  initializeEvents();
}
