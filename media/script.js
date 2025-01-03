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

function postVsCodeMessage(command, payload) {
  try {
    vscode.postMessage({ command, ...payload });
  } catch (err) {
    console.error(err);
  }
}

function onDelete(workspace) {
  postVsCodeMessage('delete', { workspaces: [workspace] });
}

function onDeleteSelected() {
  const selectedWorkspaces = map.call(document.querySelectorAll('input[type="checkbox"].check:checked'), e => e.value);
  postVsCodeMessage('delete', { workspaces: selectedWorkspaces });
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
  postVsCodeMessage('refresh', {});
}

function requestStorageSize(name, cellEl) {
  postVsCodeMessage('get-storage-size', { name });
  cellEl.innerHTML = spinnerSvg;
}

function requestWorkspaceSize(name, cellEl) {
  postVsCodeMessage('get-workspace-size', { name });
  cellEl.innerHTML = spinnerSvg;
}

function requestAllStorageSizes() {
  postVsCodeMessage('get-all-storage-sizes', {});
  document.querySelectorAll('table[id="workspaces"] td.storage-size').forEach(e => (e.innerHTML = spinnerSvg));
}

function requestAllWorkspaceSizes() {
  postVsCodeMessage('get-all-workspace-sizes', {});

  document.querySelectorAll('table[id="workspaces"] td.workspace-size').forEach(e => {
    const workspace = currentWorkspaces.find(w => w.name === e.parentElement.id);

    if (!workspace) {
      return;
    }

    if (workspace.type === 'folder' || (workspace.type === 'workspace' && workspace.workspace?.folders?.length > 0)) {
      e.innerHTML = spinnerSvg;
    }
  });
}

function requestBrowseWorkspaceStorage(name) {
  postVsCodeMessage('browse-folder', { name });
}

function requestBrowseFolder(path) {
  postVsCodeMessage('browse-folder', { path });
}

function requestOpenFile(path) {
  postVsCodeMessage('open-file', { path });
}

let lastCheckedCheckbox = null;

function createCheckboxCell(workspace) {
  const td = document.createElement('td');
  td.className = 'checkbox';

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

  td.appendChild(checkbox);

  return [checkbox, td];
}

function createNameCell(workspace) {
  const td = document.createElement('td');
  td.className = 'name';

  const a = document.createElement('a');
  a.href = 'javascript:';
  a.textContent = workspace.name;

  a.addEventListener('click', event => {
    event.stopPropagation();

    requestBrowseWorkspaceStorage(workspace.name);
  });

  td.appendChild(a);

  return td;
}

function createStorageSizeCell(workspace) {
  const td = document.createElement('td');
  td.className = 'storage-size';

  const a = document.createElement('a');
  a.href = 'javascript:';
  a.className = 'icon';
  a.textContent = '🔍';
  a.title = 'Get storage size';

  a.addEventListener('click', event => {
    event.stopPropagation();

    requestStorageSize(workspace.name, td);
  });

  td.appendChild(a);

  return td;
}

function getWorkspaceTypeName(workspace) {
  switch (workspace.type) {
    case 'folder':
      return 'Folder';

    case 'remote':
      switch (workspace.remote.type) {
        case 'dev-container':
          return 'Remote (Dev Container)';
        case 'github':
          return 'Remote (GitHub Repository)';
        case 'github-codespaces':
          return 'Remote (GitHub Codespaces)';
        case 'ssh':
          return 'Remote (SSH)';
        case 'wsl':
          return 'Remote (WSL)';
        default:
          return 'Remote';
      }

    case 'workspace':
      return 'Workspace';

    default:
      return 'Error';
  }
}

function createTypeCell(workspace) {
  const td = document.createElement('td');
  td.className = 'type';

  td.textContent = getWorkspaceTypeName(workspace);

  return td;
}

function createPathCell(workspace) {
  const td = document.createElement('td');
  const classes = ['path'];

  if (workspace.type === 'folder') {
    classes.push('folder');

    if (workspace.folder) {
      const a = document.createElement('a');
      a.href = 'javascript:';

      if (workspace.folder.exists) {
        a.textContent = workspace.folder.path;

        classes.push('exists');
      } else {
        a.textContent = `${workspace.folder.path} ⛓️‍💥`;
      }

      a.addEventListener('click', event => {
        event.stopPropagation();

        requestBrowseFolder(workspace.folder.path);
      });

      td.appendChild(a);
    } else {
      td.textContent = 'Folder path not found in workspace.json';
    }
  } else if (workspace.type === 'workspace') {
    fillWorkspacePathCell(workspace, td, classes);
  } else if (workspace.type === 'remote') {
    classes.push('remote');

    td.textContent = workspace.remote.path;
  } else {
    classes.push('broken');

    td.textContent = workspace.error;
  }

  td.className = classes.join(' ');

  return td;
}

function fillWorkspacePathCell(workspace, td, classes) {
  classes.push('workspace');

  const divWorkspace = document.createElement('div');
  divWorkspace.className = 'workspace';

  const aCodeWorkspace = document.createElement('a');
  aCodeWorkspace.href = 'javascript:';

  if (workspace.workspace.exists) {
    aCodeWorkspace.textContent = workspace.workspace.path;
    classes.push('exists');
  } else {
    aCodeWorkspace.textContent = `${workspace.workspace.path} ⛓️‍💥`;
  }

  aCodeWorkspace.addEventListener('click', event => {
    event.stopPropagation();
    requestOpenFile(workspace.workspace.path);
  });

  divWorkspace.appendChild(aCodeWorkspace);
  td.appendChild(divWorkspace);

  if (workspace.workspace.folders && workspace.workspace.folders.length > 0) {
    for (const folder of workspace.workspace.folders) {
      const divFolder = document.createElement('div');
      divFolder.className = 'folder';
      divFolder.dataset.folder = folder.path;

      const spanPath = document.createElement('span');
      spanPath.className = 'path';

      const aFolder = document.createElement('a');
      aFolder.href = 'javascript:';

      if (folder.exists) {
        aFolder.textContent = folder.path;
      } else {
        aFolder.textContent = `${folder.path} ⛓️‍💥`;
      }

      aFolder.addEventListener('click', event => {
        event.stopPropagation();
        requestBrowseFolder(folder.path);
      });

      spanPath.appendChild(aFolder);
      divFolder.appendChild(spanPath);

      const spanSize = document.createElement('span');
      spanSize.className = 'size';
      spanSize.textContent = '-';
      divFolder.appendChild(spanSize);

      divFolder.dataset.folder = folder.path;
      divFolder.dataset.folderExists = folder.exists;

      td.appendChild(divFolder);
    }
  } else {
    const divNoWorkspaceFolders = document.createElement('div');
    divNoWorkspaceFolders.className = 'no-folder';
    divNoWorkspaceFolders.textContent = `No folder found in ${workspace.workspace.path}`;
    td.appendChild(divNoWorkspaceFolders);
  }
}

function createWorkspaceSizeCell(workspace) {
  const td = document.createElement('td');
  td.className = 'workspace-size';

  if (
    (workspace.type === 'folder' && workspace.folder.exists) ||
    (workspace.type === 'workspace' && workspace.workspace.folders.some(f => f.exists))
  ) {
    const a = document.createElement('a');
    a.href = 'javascript:';
    a.className = 'icon';
    a.textContent = '🔍';
    a.title = 'Get workspace size';

    a.addEventListener('click', event => {
      event.stopPropagation();

      requestWorkspaceSize(workspace.name, td);
    });

    td.appendChild(a);
  } else {
    td.textContent = '-';
  }

  return td;
}

function createActionsCell(workspace) {
  const td = document.createElement('td');
  td.className = 'actions';

  const a = document.createElement('a');
  a.href = 'javascript:';
  a.textContent = 'Delete';
  a.title = 'Delete workspace storage';

  a.addEventListener('click', event => {
    event.stopPropagation();

    onDelete(workspace.name);
  });

  td.appendChild(a);

  return td;
}

function createWorkspaceRow(workspace) {
  const tr = document.createElement('tr');
  tr.id = workspace.name;
  tr.dataset.workspace = workspace;

  const [checkbox, tdCheckboxCell] = createCheckboxCell(workspace);

  tr.appendChild(tdCheckboxCell);
  tr.appendChild(createNameCell(workspace));
  tr.appendChild(createStorageSizeCell(workspace));
  tr.appendChild(createTypeCell(workspace));
  tr.appendChild(createPathCell(workspace));
  tr.appendChild(createWorkspaceSizeCell(workspace));
  tr.appendChild(createActionsCell(workspace));

  tr.addEventListener('click', event => {
    checkbox.checked = !checkbox.checked;

    const checkboxChangeEvent = new Event('change');

    checkbox.dispatchEvent(checkboxChangeEvent);

    handleCheckboxClick(checkbox, event.shiftKey);
  });

  return tr;
}

function setWorkspaces(workspaces) {
  const table = document.querySelector('table[id="workspaces"]');

  const tbody = table.querySelector('tbody');

  if (!tbody) {
    return;
  }

  tbody.innerHTML = '';

  lastCheckedCheckbox = null;

  const selectAllCheckbox = document.getElementById('select-all');

  if (selectAllCheckbox) {
    selectAllCheckbox.checked = false;
  }

  setSelectedCheckboxCount(0);

  for (const workspace of workspaces) {
    const tr = createWorkspaceRow(workspace);

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