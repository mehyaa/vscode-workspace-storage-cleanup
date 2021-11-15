# Workspace Storage Cleanup

A cleaner for VSCode workspace storage cache.

## Why you need this extension?

Why you need this extension?

VSCode tracks each workspace (opened folder) in its workspace storage (a folder in `Code/User/workspaceStorage/<32-length ID>`) which has meta that points to the opened folder. When you delete/rename/move the folder, the workspace storage will not update itself and from now on it becomes an unused info. This extension clears the unused workspace storage folders.

## Installation

Install from [Marketplace][marketplace-url] page.

## Build

```sh
$ npm install

$ npm run compile
```

## Contributing

1. Fork it (<https://github.com/mehyaa/vscode-workspace-storage-cleanup>)
2. Create your feature branch (`git checkout -b feature/<feature_name>`)
3. Commit your changes (`git commit -am '<type>(<scope>): added some feature'`)
4. Push to the branch (`git push origin feature/<feature_name>`)
5. Create a Pull Request

## License

[MIT][license-url]

## Thanks

Icon made by [Flat Icons][icon-author-url] from [flaticon.com][icon-url]


[license-url]: LICENSE
[marketplace-url]: https://marketplace.visualstudio.com/items?itemName=mehyaa.workspace-storage-cleanup
[icon-url]: https://www.flaticon.com/free-icon/data-cleaning_1808958
[icon-author-url]: https://www.flaticon.com/authors/flat-icons
