# JustLang-LSP Extension

## Overview
JustLang-LSP is a Visual Studio Code extension designed to enhance the development experience by providing task automation and integration with JustLang syntax. It supports `Justfile` (any capitalization), `.justfile`, and `*.just` formats. This extension leverages the VS Code API to register commands and task providers, enabling seamless execution of tasks defined in JustLang files.

This extension now includes a language client for the `just-lsp` language server, providing features like completion, diagnostics, and more.

## Features
- **Language Server Integration**: Connects to the `just-lsp` language server for advanced language features.
- **Task Provider Integration**: Automatically detects and registers tasks from JustLang files (`Justfile`, `.justfile`, or `*.just`).
- **Command Registration**: Includes a sample command (`justlang-lsp.helloWorld`) for demonstration purposes.
- **Compatibility**: Ensures proper integration with VS Code's command and subscription mechanisms.
- **Syntax Highlighting**: Provides syntax highlighting for JustLang files using TextMate grammar (`syntaxes/just.tmLanguage.yaml`).
- **Language Configuration**: Adds language configuration for JustLang files (`language-configuration.json`), including comments, brackets, and auto-closing pairs.

## Requirements

This extension requires the `just-lsp` language server to be installed on your system. You can install it by following the instructions in the [just-lsp repository](https://github.com/your-repo/just-lsp).

Once installed, you can either add the `just-lsp` executable to your system's `PATH` or specify the path to the executable in your VS Code settings using the `justlang-lsp.server.path` setting.

## How to Use
1. Install the extension in Visual Studio Code.
2. Install the `just-lsp` language server.
3. Open a workspace containing a JustLang file (`Justfile`, `.justfile`, or `*.just`).
4. Run tasks directly from the VS Code task interface.

## Development
### Prerequisites
- Node.js
- TypeScript
- PNPM
- Rust and Cargo

### Setup
1. Clone the repository.
2. Run `pnpm install` to install dependencies.
3. Use `pnpm run compile` to build the extension.

### Testing
Run `npm test` to execute the test suite.

## References

* https://code.visualstudio.com/api/references/contribution-points#contributes.languages

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.


### Attribution
Syntax highlighting and language configuration features were adapted from the [wolfmah-vscode.just-syntax](https://github.com/wolfmah-vscode/just-syntax) repository under the Mozilla Public License 2.0 (MPL 2.0). See the [LICENSE](LICENSE) file for details.

## Thanks
* skellock
* 