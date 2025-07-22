# JustLang-LSP Extension

## Overview
JustLang-LSP is a Visual Studio Code extension designed to enhance the development experience by providing task automation and integration with JustLang syntax. It supports `Justfile` (any capitalization), `.justfile`, and `*.just` formats. This extension leverages the VS Code API to register commands and task providers, enabling seamless execution of tasks defined in JustLang files.

## Features
- **Task Provider Integration**: Automatically detects and registers tasks from JustLang files (`Justfile`, `.justfile`, or `*.just`).
- **Command Registration**: Includes a sample command (`justlang-lsp.helloWorld`) for demonstration purposes.
- **Compatibility**: Ensures proper integration with VS Code's command and subscription mechanisms.
- **Syntax Highlighting**: Provides syntax highlighting for JustLang files using TextMate grammar (`syntaxes/just.tmLanguage.yaml`).
- **Language Configuration**: Adds language configuration for JustLang files (`language-configuration.json`), including comments, brackets, and auto-closing pairs.

## Implementation Summary
### Refactoring
The logic for task detection and execution was refactored into `src/extracted_task_provider.ts`:
- Updated to ESNext syntax for modern JavaScript/TypeScript standards.
- Ensured compliance with ESLint rules for code quality.

### Activation Logic
The task provider was integrated into the extension's activation logic (`src/extension.ts`):
- Registered the `JustTaskProvider` to detect tasks from `justfile`.
- Added the task provider to the extension's subscriptions for proper cleanup.

### Compatibility
Verified compatibility with existing command registration and subscriptions:
- Ensured no conflicts between the task provider and the `justlang-lsp.helloWorld` command.

### Testing
Thoroughly tested the integration:
- Added unit tests in `src/test/extension.test.ts` to validate task provider registration and command functionality.
- Fixed issues related to mock `ExtensionContext` and syntax errors.

## How to Use
1. Install the extension in Visual Studio Code.
2. Open a workspace containing a JustLang file (`Justfile`, `.justfile`, or `*.just`).
3. Run tasks directly from the VS Code task interface.

## Development
### Prerequisites
- Node.js
- TypeScript
- PNPM

### Setup
1. Clone the repository.
2. Run `pnpm install` to install dependencies.
3. Use `pnpm run compile` to build the extension.

### Testing
Run `npm test` to execute the test suite.

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

### Attribution
Syntax highlighting and language configuration features were adapted from the [wolfmah-vscode.just-syntax](https://github.com/wolfmah-vscode/just-syntax) repository under the Mozilla Public License 2.0 (MPL 2.0). See the [LICENSE](LICENSE) file for details.

## Thanks
* skellock
* 