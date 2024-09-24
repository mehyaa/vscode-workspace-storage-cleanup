const indexOf = Array.prototype.indexOf;
const map = Array.prototype.map;

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
  const selectedCheckboxes = document.querySelectorAll('input[type="checkbox"].check:checked');
  const selectedWorkspaces = map.call(selectedCheckboxes, e => e.value);

  vscode.postMessage({
    command: 'delete',
    workspaces: selectedWorkspaces
  });
}

function setSelectedCheckboxCount(count) {
  if (count == null) {
    const checkedCheckboxes = document.querySelectorAll('input[type="checkbox"].check:checked');

    count = checkedCheckboxes.length;
  }

  document.querySelectorAll('span.selected-count').forEach(e => (e.textContent = count));
}

function onSelectCheckboxes(selector) {
  document.querySelectorAll(selector).forEach(e => (e.checked = true));

  setSelectedCheckboxCount();
}

function onSelectFolderMissing() {
  onSelectCheckboxes('input[type="checkbox"].check.folder-missing');
}

function onSelectWorkspace() {
  onSelectCheckboxes('input[type="checkbox"].check.workspace');
}

function onSelectRemote() {
  onSelectCheckboxes('input[type="checkbox"].check.remote');
}

function onSelectBroken() {
  onSelectCheckboxes('input[type="checkbox"].check.broken');
}

function onInvertSelection() {
  document.querySelectorAll('input[type="checkbox"].check').forEach(e => (e.checked = !e.checked));

  setSelectedCheckboxCount();
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

    if (workspace?.type === 'folder' || workspace?.type === 'workspace') {
      e.innerHTML = spinnerSvg;
    }
  });
}

function requestBrowseWorkspace(name) {
  vscode.postMessage({
    command: 'browse-workspace',
    name: name
  });
}

let lastCheckedCheckbox = null;

function setWorkspaces(workspaces) {
  const table = document.querySelector('table[id="workspaces"]');

  const tbody = table.querySelector('tbody');

  tbody.innerHTML = '';

  lastCheckedCheckbox = null;

  const selectAllCheckbox = document.getElementById('select-all');

  if (selectAllCheckbox) {
    selectAllCheckbox.checked = false;
  }

  setSelectedCheckboxCount(0);

  for (const workspace of workspaces) {
    const tr = document.createElement('tr');
    tr.id = workspace.name;
    tr.dataset.workspace = workspace;

    const tdCheckbox = document.createElement('td');
    tdCheckbox.className = 'checkbox';

    function handleCheckboxClick(checkbox, shiftKey) {
      if (!lastCheckedCheckbox) {
        lastCheckedCheckbox = checkbox;
        return;
      }

      if (shiftKey) {
        const rowCheckboxes = document.querySelectorAll('input[type="checkbox"].check');

        let start = indexOf.call(rowCheckboxes, checkbox);
        let end = indexOf.call(rowCheckboxes, lastCheckedCheckbox);

        if (start > end) {
          [start, end] = [end, start];
        }

        for (let i = start; i <= end; i++) {
          rowCheckboxes[i].checked = lastCheckedCheckbox.checked;
        }
      }

      lastCheckedCheckbox = checkbox;
    }

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = workspace.name;

    const checkboxClasses = ['check'];

    if (workspace.type === 'folder') {
      checkboxClasses.push('folder');

      if (!workspace.folder?.exists) {
        checkboxClasses.push('folder-missing');
      }
    } else if (workspace.type === 'workspace') {
      checkboxClasses.push('workspace');

      if (workspace.folders?.some(f => !f.exists)) {
        checkboxClasses.push('folder-missing');
      }
    } else if (workspace.type === 'remote') {
      checkboxClasses.push('remote');
    } else if (workspace.type === 'url') {
      checkboxClasses.push('url');
    } else {
      checkboxClasses.push('broken');
    }

    checkbox.className = checkboxClasses.join(' ');
    checkbox.addEventListener('click', event => {
      event.stopPropagation();

      handleCheckboxClick(checkbox, event.shiftKey);
    });
    checkbox.addEventListener('change', event => {
      const checkedCheckboxes = document.querySelectorAll('input[type="checkbox"].check:checked');

      if (selectAllCheckbox) {
        selectAllCheckbox.checked =
          document.querySelectorAll('input[type="checkbox"].check').length === checkedCheckboxes.length;
      }

      setSelectedCheckboxCount(checkedCheckboxes.length);
    });
    tdCheckbox.appendChild(checkbox);
    tr.appendChild(tdCheckbox);

    const tdName = document.createElement('td');
    tdName.className = 'name';

    const aBrowse = document.createElement('a');
    aBrowse.href = 'javascript:';
    aBrowse.textContent = workspace.name;
    aBrowse.addEventListener('click', event => {
      event.stopPropagation();

      requestBrowseWorkspace(workspace.name);
    });
    tdName.appendChild(aBrowse);
    tr.appendChild(tdName);

    const tdStorageSize = document.createElement('td');
    tdStorageSize.className = 'storage-size';

    const aRequestStorageSize = document.createElement('a');
    aRequestStorageSize.href = 'javascript:';
    aRequestStorageSize.className = 'icon';
    aRequestStorageSize.textContent = '🔍';
    aRequestStorageSize.title = 'Get storage size';
    aRequestStorageSize.addEventListener('click', event => {
      event.stopPropagation();

      requestStorageSize(workspace.name, tdStorageSize);
    });
    tdStorageSize.appendChild(aRequestStorageSize);
    tr.appendChild(tdStorageSize);

    const tdType = document.createElement('td');
    tdType.className = 'type';
    switch (workspace.type) {
      case 'folder':
        tdType.textContent = 'Folder';
        break;
      case 'remote':
        switch (workspace.remote.type) {
          case 'dev-container':
            tdType.textContent = 'Remote (Dev Container)';
            break;
          case 'github':
            tdType.textContent = 'Remote (GitHub Repository)';
            break;
          case 'github-codespaces':
            tdType.textContent = 'Remote (GitHub Codespaces)';
            break;
          case 'ssh':
            tdType.textContent = 'Remote (SSH)';
            break;
          case 'wsl':
            tdType.textContent = 'Remote (WSL)';
            break;
          default:
            tdType.textContent = 'Remote';
            break;
        }
        break;
      case 'workspace':
        tdType.textContent = 'Workspace';
        break;
      default:
        tdType.textContent = 'Error';
        break;
    }
    tr.appendChild(tdType);

    const tdPath = document.createElement('td');
    const tdPathClasses = ['path'];

    if (workspace.type === 'folder') {
      tdPathClasses.push('folder');

      if (workspace.folder) {
        if (workspace.folder.exists) {
          tdPath.textContent = workspace.folder.path;

          tdPathClasses.push('exists');
        } else {
          tdPath.textContent = `${workspace.path} ⛓️‍💥`;
        }
      } else {
        tdPath.textContent = 'Folder path not found';
      }
    } else if (workspace.type === 'workspace') {
      tdPathClasses.push('workspace');

      const divWorkspace = document.createElement('div');
      divWorkspace.className = 'workspace';

      if (workspace.workspace.exists) {
        divWorkspace.textContent = workspace.workspace.path;
      } else {
        divWorkspace.textContent = `${workspace.workspace.path} ⛓️‍💥`;
      }

      tdPath.appendChild(divWorkspace);

      if (workspace.workspace.folders && workspace.workspace.folders.length > 0) {
        for (const folder of workspace.workspace.folders) {
          const divFolder = document.createElement('div');
          divFolder.className = 'folder';
          divFolder.dataset.folder = folder.path;

          const spanPath = document.createElement('span');
          spanPath.className = 'path';
          spanPath.textContent = folder.exists ? folder.path : `${folder.path} ⛓️‍💥`;
          divFolder.appendChild(spanPath);

          const spanSize = document.createElement('span');
          spanSize.className = 'size';
          spanSize.textContent = '-';
          divFolder.appendChild(spanSize);

          divFolder.dataset.folder = folder.path;
          divFolder.dataset.folderExists = folder.exists;

          tdPath.appendChild(divFolder);
        }
      } else {
        tdPath.textContent = 'Workspace folders not found';
      }
    } else if (workspace.type === 'remote') {
      tdPathClasses.push('remote');

      tdPath.textContent = workspace.remote.path;
    } else {
      tdPathClasses.push('broken');

      tdPath.textContent = workspace.error;
    }

    tdPath.className = tdPathClasses.join(' ');
    tr.appendChild(tdPath);

    const tdWorkspaceSize = document.createElement('td');
    tdWorkspaceSize.className = 'workspace-size';

    if (
      (workspace.type === 'folder' && workspace.folder.exists) ||
      (workspace.type === 'workspace' && workspace.workspace.folders.some(f => f.exists))
    ) {
      const aRequestWorkspaceSize = document.createElement('a');
      aRequestWorkspaceSize.href = 'javascript:';
      aRequestWorkspaceSize.className = 'icon';
      aRequestWorkspaceSize.textContent = '🔍';
      aRequestWorkspaceSize.title = 'Get workspace size';
      aRequestWorkspaceSize.addEventListener('click', event => {
        event.stopPropagation();

        requestWorkspaceSize(workspace.name, tdWorkspaceSize);
      });
      tdWorkspaceSize.appendChild(aRequestWorkspaceSize);
    } else {
      tdWorkspaceSize.textContent = '-';
    }

    tr.appendChild(tdWorkspaceSize);

    const tdActions = document.createElement('td');
    tdActions.className = 'actions';

    const aDelete = document.createElement('a');
    aDelete.href = 'javascript:';
    aDelete.textContent = 'Delete';
    aDelete.title = 'Delete workspace';
    aDelete.addEventListener('click', event => {
      event.stopPropagation();

      onDelete(workspace.name);
    });
    tdActions.appendChild(aDelete);
    tr.appendChild(tdActions);

    tr.addEventListener('click', event => {
      checkbox.checked = !checkbox.checked;

      const checkboxChangeEvent = new Event('change');

      checkbox.dispatchEvent(checkboxChangeEvent);

      handleCheckboxClick(checkbox, event.shiftKey);
    });

    tbody.appendChild(tr);
  }

  const loading = document.getElementById('loading');

  if (loading) {
    loading.style.display = 'none';
  }

  const content = document.getElementById('content');

  if (content) {
    content.style.display = 'block';
  }

  document.querySelectorAll('span.workspace-count').forEach(e => (e.textContent = workspaces.length));
}

function setStorageSizeOnTable(name, size) {
  const table = document.querySelector('table[id="workspaces"]');

  if (!table) {
    return;
  }

  const tr = table.querySelector(`tr[id="${name}"]`);

  if (!tr) {
    return;
  }

  const td = tr.querySelector('td.storage-size');

  if (!td) {
    return;
  }

  td.textContent = humanFileSize(size);
}

function setWorkspaceSizeOnTable(name, size) {
  const table = document.querySelector('table[id="workspaces"]');

  if (!table) {
    return;
  }

  const tr = table.querySelector(`tr[id="${name}"]`);

  if (!tr) {
    return;
  }

  const td = tr.querySelector('td.workspace-size');

  if (!td) {
    return;
  }

  td.textContent = humanFileSize(size);
}

function setWorkspaceSizesOnTable(name, entries) {
  const table = document.querySelector('table[id="workspaces"]');

  if (!table) {
    return;
  }

  const tr = table.querySelector(`tr[id="${name}"]`);

  if (!tr) {
    return;
  }

  const tdPath = tr.querySelector('td.path');

  if (!tdPath) {
    return;
  }

  entries = entries ?? [];

  let totalSize = 0;

  tdPath.querySelectorAll('div.folder').forEach(div => {
    const folder = div.dataset.folder;

    const entry = entries.find(e => e.path === folder);

    const span = div.querySelector('span.size');

    if (entry) {
      totalSize += entry.size;

      if (span) {
        span.textContent = humanFileSize(entry.size);
      }
    } else {
      if (span) {
        span.textContent = '-';
      }
    }
  });

  const tdWorkspaceSize = tr.querySelector('td.workspace-size');

  if (!tdWorkspaceSize) {
    return;
  }

  tdWorkspaceSize.textContent = humanFileSize(totalSize);
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
        setStorageSizeOnTable(message.name, message.size);
      }

      break;

    case 'set-workspace-size':
      {
        setWorkspaceSizeOnTable(message.name, message.size);
      }

      break;

    case 'set-workspace-sizes':
      {
        setWorkspaceSizesOnTable(message.name, message.sizes);
      }

      break;
  }
});

function initializeEvents() {
  const selectFolderMissingButton = document.getElementById('select-folder-missing');

  if (selectFolderMissingButton) {
    selectFolderMissingButton.addEventListener('click', onSelectFolderMissing);
  }

  const selectWorkspaceButton = document.getElementById('select-workspace');

  if (selectWorkspaceButton) {
    selectWorkspaceButton.addEventListener('click', onSelectWorkspace);
  }

  const selectRemoteButton = document.getElementById('select-remote');

  if (selectRemoteButton) {
    selectRemoteButton.addEventListener('click', onSelectRemote);
  }

  const selectBrokenButton = document.getElementById('select-broken');

  if (selectBrokenButton) {
    selectBrokenButton.addEventListener('click', onSelectBroken);
  }

  const invertSelectionButton = document.getElementById('invert-selection');

  if (invertSelectionButton) {
    invertSelectionButton.addEventListener('click', onInvertSelection);
  }

  const refreshButton = document.getElementById('refresh');

  if (refreshButton) {
    refreshButton.addEventListener('click', onRefresh);
  }

  const selectAllCheckbox = document.getElementById('select-all');

  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', () => {
      document.querySelectorAll('input[type="checkbox"].check').forEach(cb => (cb.checked = selectAllCheckbox.checked));

      setSelectedCheckboxCount(selectAllCheckbox.checked ? currentWorkspaces.length : 0);
    });
  }

  const requestAllStorageSizesIcon = document.getElementById('request-all-storage-sizes');

  if (requestAllStorageSizesIcon) {
    requestAllStorageSizesIcon.addEventListener('click', requestAllStorageSizes);
  }

  const requestAllWorkspaceSizesIcon = document.getElementById('request-all-workspace-sizes');

  if (requestAllWorkspaceSizesIcon) {
    requestAllWorkspaceSizesIcon.addEventListener('click', requestAllWorkspaceSizes);
  }

  const deleteSelectedButton = document.getElementById('delete-selected');

  if (deleteSelectedButton) {
    deleteSelectedButton.addEventListener('click', onDeleteSelected);
  }

  onRefresh();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeEvents);
} else {
  initializeEvents();
}
