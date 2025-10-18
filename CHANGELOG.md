## [1.0.5](https://github.com/elasticdotventures/just-vscode-extension/compare/v1.0.4...v1.0.5) (2025-10-18)

### Features

- add winget support to automatically install Rust/Cargo on Windows when missing ([just-lsp-installer.ts:259](https://github.com/elasticdotventures/just-vscode-extension/blob/main/src/just-lsp-installer.ts#L259))
- improve manual installation instructions with platform-specific guidance including winget commands

### Bug Fixes

- fix Windows PowerShell compatibility in just-lsp installer ([just-lsp-installer.ts:184](https://github.com/elasticdotventures/just-vscode-extension/blob/main/src/just-lsp-installer.ts#L184))
- improve executable detection on Windows to check file extensions instead of Unix permissions
- enhance cargo installation with proper Windows command handling (cargo.exe)
- add detailed error logging to identify which installation methods fail
- improve PATH search to handle both with and without .exe extensions on Windows
- clarify distinction between just-lsp (language server) and just (command runner) in installation prompts

## [1.0.4](https://github.com/elasticdotventures/just-vscode-extension/compare/v1.0.3...v1.0.4) (2025-10-18)

## [1.0.3](https://github.com/elasticdotventures/just-vscode-extension/compare/v1.0.2...v1.0.3) (2025-08-15)

### Bug Fixes

- remove automatic Problems panel focus to prevent stealing focus while typing in justfiles ([client.ts:138](https://github.com/elasticdotventures/just-vscode-extension/blob/main/src/client.ts#L138))

## [1.0.2](https://github.com/elasticdotventures/just-vscode-extension/compare/v1.0.1...v1.0.2) (2025-08-05)

### Bug Fixes

* replace VSCE GitHub Action with direct vsce publish command ([abbf5fe](https://github.com/elasticdotventures/just-vscode-extension/commit/abbf5febb96bb066c7152a6c6eee9a1f855a348a))

## [1.0.1](https://github.com/elasticdotventures/just-vscode-extension/compare/v1.0.0...v1.0.1) (2025-08-05)

### Bug Fixes

- revert version to 0.0.35 for proper marketplace publishing ([c888574](https://github.com/elasticdotventures/just-vscode-extension/commit/c888574e724e07019e2a441925943d8962bb0b49))

# 1.0.0 (2025-08-05)

### Bug Fixes

- disable OpenVSX publishing to fix release workflow ([93e7ceb](https://github.com/elasticdotventures/just-vscode-extension/commit/93e7ceb517771622476908bd3f0577a400074920))
- implement LSP server restart mechanism for Justfile changes ([#4](https://github.com/elasticdotventures/just-vscode-extension/issues/4)) ([f7b0b79](https://github.com/elasticdotventures/just-vscode-extension/commit/f7b0b7957129d72b2bbe06c40b8d7d5a9efabb72)), closes [#3](https://github.com/elasticdotventures/just-vscode-extension/issues/3)
- integrate just build system with GitHub Actions release workflow ([ed88ec7](https://github.com/elasticdotventures/just-vscode-extension/commit/ed88ec72797946637e79add37afcc4e34e9c6b7c))
- remove unused OVSX_PAT environment variable from release workflow ([73dc7e4](https://github.com/elasticdotventures/just-vscode-extension/commit/73dc7e48ff11c3d2483e9b952ade8d35c75c2d1d))
- resolve command registration conflict causing LSP client startup failure ([e53cc91](https://github.com/elasticdotventures/just-vscode-extension/commit/e53cc91abf0b355638734560bc8df53d09a59307))
- resolve vsce command path in custom packaging script ([252217b](https://github.com/elasticdotventures/just-vscode-extension/commit/252217b93933123a5bb3462d355b33021a0ba070))
- simplify CI testing to avoid vscode-test-cli build issues ([a1165d5](https://github.com/elasticdotventures/just-vscode-extension/commit/a1165d53f3d436a628879988c0c22a2ca874da78))
- testing husky ([70a96b8](https://github.com/elasticdotventures/just-vscode-extension/commit/70a96b8514ccf51e7ab0de4dddc69103d0246048))
- update GitHub Actions workflow to handle vscode-test-cli build issues ([e7f6057](https://github.com/elasticdotventures/just-vscode-extension/commit/e7f6057a2dc420859d5341b8b76e1aa7ed0b8cae))
- update test command in GitHub Actions to use vscode-test properly ([d2ac228](https://github.com/elasticdotventures/just-vscode-extension/commit/d2ac22865d083eacc596e88bd2b10172e6d3a364))
- use VSCE GitHub Action with custom packaging ([a3c57b8](https://github.com/elasticdotventures/just-vscode-extension/commit/a3c57b81eb233bdaf17db8848cb4b92de113878a))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Updated repository references to `elasticdotventures/just-vscode-extension`
- Set up automated release workflow with semantic-release
- Added conventional commit tooling (commitizen, commitlint, husky)

## [0.0.33] - Previous Release

See git history for previous changes.
