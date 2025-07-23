# JustLang-LSP Extension

## Overview
JustLang-LSP is a Visual Studio Code extension designed to enhance the development experience by providing task automation and integration with JustLang syntax. It supports `Justfile` (any capitalization), `.justfile`, and `*.just` formats. This extension leverages the VS Code API to register commands and task providers, enabling seamless execution of tasks defined in JustLang files.

This extension now includes a language client for the `just-lsp` language server, providing features like completion, diagnostics, and more.

## Features

### Language Server Features
- **Rich Completions**: 133 built-in functions, attributes, constants, and settings with detailed documentation
- **Hover Documentation**: Function signatures, descriptions, and version information
- **Go-to-Definition**: Navigate to recipe and variable definitions
- **Find References**: Find all references to recipes and variables
- **Symbol Rename**: Rename symbols across the entire project
- **Document Formatting**: Format Just files with proper indentation and structure
- **Code Actions**: Quick fixes and refactoring suggestions

### VSCode Integration
- **Task Provider Integration**: Automatically detects and registers tasks from JustLang files (`Justfile`, `.justfile`, or `*.just`)
- **Recipe Execution**: Run recipes directly from the editor with live output streaming
- **Command Registration**: Enhanced command palette integration with recipe execution
- **Syntax Highlighting**: Comprehensive syntax highlighting using TextMate grammar
- **Language Configuration**: Smart bracket matching, auto-closing pairs, and comment handling

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
open a justfile
    Developer: Inspect Editor Tokens and Scopes


## References

* https://code.visualstudio.com/api/references/contribution-points#contributes.languages

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.


### Attribution

**Language Server Integration**: This extension integrates with the `just-lsp` language server, which provides advanced language features including completions, hover documentation, go-to-definition, references, rename, and formatting capabilities. The language server supports 133 built-in functions, attributes, constants, and settings for comprehensive Just language support.

**Syntax Highlighting**: Syntax highlighting and language configuration features were adapted from the [wolfmah-vscode.just-syntax](https://github.com/wolfmah-vscode/just-syntax) repository under the Mozilla Public License 2.0 (MPL 2.0). See the [LICENSE](LICENSE) file for details.

## Thanks
* skellock
* 