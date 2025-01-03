# VS Code Workspace Storage Cleanup Extension

![Build Status](build-status-badge-url)

## Overview

The **Workspace Storage Cleanup** extension for Visual Studio Code is designed to help users manage and clean up workspace storage files effortlessly. These files can accumulate over time and occupy significant disk space, potentially slowing down the IDE. With this extension, developers can streamline their workspace by removing unnecessary storage files, improving performance and maintaining a clutter-free development environment.

- **Extension URL**: [VS Marketplace](marketplace-url)
- **Source Code**: [GitHub Repository](repo-url)

---

## Why You Need This Extension

Visual Studio Code keeps a dedicated storage folder for each workspace (folder, `.code-workspace` file, or remote repo), located under `Code/User/workspaceStorage/<uniqueID>`. When these workspaces are renamed, moved, or deleted, the storage folders remain and become unused. This extension detects and removes those orphaned folders, helping you keep your workspace storage clean and efficient.

---

## Features

### 1. **Interactive Workspace Panel**

- View and manage workspace storage files via a dedicated panel.
- The panel displays the workspace name, storage size, type, path, and actions (e.g., delete).

### 2. **Command-Based Cleanup Options**

- Use specific commands to clean up workspaces based on certain conditions such as missing folders, broken links, or empty files.

### 3. **Simple and Intuitive UI**

- Designed to be user-friendly, with clear actions and prompts.

---

## Installation

### From the Visual Studio Code Marketplace

1. Open Visual Studio Code.
2. Go to the Extensions view by clicking the Extensions icon in the Activity Bar (or press `Ctrl+Shift+X`).
3. Search for **Workspace Storage Cleanup**.
4. Click **Install**.

### From the VSIX File

1. Download the latest `.vsix` file from the [GitHub Releases](releases-url).
2. Open VS Code.
3. Press `Ctrl+Shift+P` to open the Command Palette and type `Extensions: Install from VSIX`.
4. Select the downloaded `.vsix` file to install.

---

## Usage

### Opening the Workspace Panel

1. Open the Command Palette (`Ctrl+Shift+P`).
2. Type `Workspace Storage Cleanup: Show Workspaces`.
3. A panel will open displaying workspace details such as:
   - **Name**: Unique identifier for the workspace.
   - **Storage Size**: Disk space occupied by the workspace.
   - **Type**: Whether the storage is a folder, remote workspace, etc.
   - **Path**: File path to the workspace storage.
   - **Actions**: Options to delete or inspect specific storage entries.

### Commands

The extension provides several commands to manage storage:

| Command                                                             | Description                                               |
| ------------------------------------------------------------------- | --------------------------------------------------------- |
| Workspace Storage Cleanup: Show Workspaces                          | Opens the interactive workspace panel for management.     |
| Workspace Storage Cleanup: Delete Workspaces with Missing Folders   | Removes workspaces whose folders are no longer available. |
| Workspace Storage Cleanup: Delete Workspaces with Broken Links      | Deletes workspaces with invalid or broken links.          |
| Workspace Storage Cleanup: Delete Empty Workspaces                  | Cleans up empty workspace storage files.                  |
| Workspace Storage Cleanup: Delete Remote Workspaces                 | Removes remote workspace storage.                         |

---

## Contributing

We welcome contributions to improve the extension! To get started:

1. **Fork the Repository**:
   - Go to the [GitHub Repository](repo-url).
   - Click the **Fork** button to create your own copy of the repository.

2. **Clone Your Fork**:
   ```sh
   git clone https://github.com/your-username/vscode-workspace-storage-cleanup.git
   ```
   Replace `your-username` with your GitHub username.

3. **Create a Feature Branch**:
   ```sh
   git checkout -b feature/your-feature-name
   ```
   Replace `your-feature-name` with a descriptive name for your feature or fix.

4. **Make Changes**:
   - Implement your feature or fix.
   - Test your changes thoroughly.

5. **Commit Your Changes**:
   ```sh
   git add .
   git commit -m "Add your descriptive commit message here"
   ```

6. **Push Your Branch**:
   ```sh
   git push origin feature/your-feature-name
   ```

7. **Create a Pull Request**:
   - Go to the original repository on GitHub.
   - Click the **Pull Requests** tab.
   - Click **New Pull Request** and select your feature branch.
   - Add a description of your changes and submit the pull request.

### Reporting Issues

- Use the [GitHub Issues page](issues-url) to report bugs or suggest new features.

---

## License

This project is licensed under the [MIT License](license-url).

---

## Support

If you encounter any issues or have questions about the extension, feel free to:

- Open a discussion on [GitHub Discussions](discussions-url).
- Reach out via the [Marketplace Page](marketplace-url).

---

## Thanks

Icon made by [Flat Icons][icon-author-url] from [flaticon.com][icon-url]


[repo-url]: https://github.com/mehyaa/vscode-workspace-storage-cleanup
[license-url]: https://github.com/mehyaa/vscode-workspace-storage-cleanup/blob/master/LICENSE
[releases-url]: https://github.com/mehyaa/vscode-workspace-storage-cleanup/releases
[discussions-url]: https://github.com/mehyaa/vscode-workspace-storage-cleanup/discussions
[issues-url]: https://github.com/mehyaa/vscode-workspace-storage-cleanup/issues
[build-status-badge-url]: https://github.com/mehyaa/vscode-workspace-storage-cleanup/actions/workflows/build.yml/badge.svg
[marketplace-url]: https://marketplace.visualstudio.com/items?itemName=mehyaa.workspace-storage-cleanup
[icon-url]: https://www.flaticon.com/free-icon/data-cleaning_1808958
[icon-author-url]: https://www.flaticon.com/authors/flat-icons
