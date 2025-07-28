# Release Process

This document provides comprehensive instructions for the automated release process of the just-vscode-extension. The project uses modern tooling for conventional commits, automated versioning, and continuous delivery.

## Overview

The release system is built around:
- **Conventional Commits** for semantic versioning
- **Semantic Release** for automated version management
- **GitHub Actions** for continuous deployment
- **VSCode Marketplace** and **Open VSX** publishing

## Toolchain

### Core Tools
- **[Commitizen](https://commitizen-tools.github.io/commitizen/)**: Interactive commit creation
- **[Commitlint](https://commitlint.js.org/)**: Commit message validation
- **[Husky](https://typicode.github.io/husky/)**: Git hooks automation
- **[Semantic Release](https://semantic-release.gitbook.io/)**: Automated versioning and publishing
- **[semantic-release-vsce](https://github.com/felipecrs/semantic-release-vsce)**: VSCode extension publishing plugin

### Configuration Files
- `commitlint.config.js` - Commit message rules
- `.releaserc.json` - Semantic release configuration
- `.github/workflows/release.yml` - GitHub Actions workflow
- `.husky/commit-msg` - Commit validation hook
- `.husky/pre-commit` - Pre-commit type checking and linting

## Conventional Commits

All commits must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Commit Types

| Type | Description | Version Impact |
|------|-------------|----------------|
| `feat` | New features | Minor (0.x.0) |
| `fix` | Bug fixes | Patch (0.0.x) |
| `docs` | Documentation changes | None |
| `style` | Code style changes | None |
| `refactor` | Code refactoring | None |
| `perf` | Performance improvements | Patch (0.0.x) |
| `test` | Test changes | None |
| `build` | Build system changes | None |
| `ci` | CI/CD changes | None |
| `chore` | Maintenance tasks | None |
| `revert` | Revert previous commit | Depends on reverted commit |

### Breaking Changes
Add `BREAKING CHANGE:` in the commit footer to trigger a major version bump (x.0.0).

```
feat: add new configuration option

BREAKING CHANGE: Configuration format has changed, requires manual migration
```

## Making Commits

### Method 1: Interactive Commitizen (Recommended)
```bash
# Stage your changes
git add .

# Use interactive commit creation
pnpm run commit
```

This will guide you through:
1. Selecting commit type
2. Entering scope (optional)
3. Writing description
4. Adding body (optional)
5. Noting breaking changes
6. Referencing issues

### Method 2: Manual Commits
```bash
# Follow conventional commit format
git commit -m "feat(parser): add support for nested expressions"
git commit -m "fix: resolve memory leak in watcher"
git commit -m "docs: update installation instructions"
```

### Validation
All commits are automatically validated by:
- **Pre-commit hook**: Runs type checking and linting
- **Commit-msg hook**: Validates commit message format

## Release Workflow

### 1. Development Phase
- Work on feature branches (`feature/`, `fix/`, `docs/`, etc.)
- Use conventional commits for all changes
- Create pull requests to `main` branch

### 2. Pull Request Process
- PR title should follow conventional commit format
- All checks must pass (linting, type checking)
- Code review required
- Squash and merge with conventional commit message

### 3. Automated Release
When merged to `main` branch, GitHub Actions automatically:

1. **Analyzes commits** since last release
2. **Determines version bump** based on commit types
3. **Generates changelog** from commit messages
4. **Updates package.json** version
5. **Creates GitHub release** with release notes
6. **Publishes to VSCode Marketplace**
7. **Publishes to Open VSX Registry**
8. **Commits changes** back to repository

### 4. Release Artifacts
- **GitHub Release**: Tagged release with generated notes
- **VSIX Package**: Built extension package
- **Marketplace Listing**: Updated VSCode Marketplace entry
- **Open VSX Listing**: Updated Open VSX Registry entry

## Manual Release Process

### Dry Run Testing
```bash
# Test release process without publishing
npx semantic-release --dry-run
```

### Emergency Manual Release
```bash
# Only use in emergencies when automation fails
pnpm run release
```

## GitHub Repository Configuration

### Required Secrets
Configure these in GitHub repository settings > Secrets and variables > Actions:

| Secret | Description | Required For |
|--------|-------------|--------------|
| `VSCE_PAT` | VSCode Marketplace Personal Access Token | Marketplace publishing |
| `OVSX_PAT` | Open VSX Registry Personal Access Token | Open VSX publishing |

### Personal Access Token Setup

#### VSCode Marketplace Token
1. Visit [Visual Studio Marketplace Publisher Management](https://marketplace.visualstudio.com/manage)
2. Create new Personal Access Token
3. Scope: **All accessible organizations**
4. Expiration: Set appropriate duration
5. Add to GitHub secrets as `VSCE_PAT`

#### Open VSX Token
1. Visit [Open VSX Registry](https://open-vsx.org/)
2. Sign in and go to user settings
3. Generate new Access Token
4. Add to GitHub secrets as `OVSX_PAT`

## Version Management

### Automatic Versioning
- **Never manually update** `package.json` version
- Versions are determined by commit analysis
- Follows [Semantic Versioning](https://semver.org/) strictly

### Version Calculation Examples
```bash
# Current version: 1.2.3

# feat: new feature → 1.3.0 (minor bump)
# fix: bug fix → 1.2.4 (patch bump)  
# feat: BREAKING CHANGE → 2.0.0 (major bump)
# docs: update readme → 1.2.3 (no bump)
```

### Pre-release Versions
For beta releases, create a `beta` branch:
```bash
git checkout -b beta
# Make changes and commit
git push origin beta
```

Semantic release will create pre-release versions like `1.3.0-beta.1`.

## Changelog Management

### Automatic Generation
- `CHANGELOG.md` is automatically updated
- Generated from conventional commit messages
- Includes links to commits and GitHub issues
- Follows [Keep a Changelog](https://keepachangelog.com/) format

### Manual Changelog Edits
If needed, edit `CHANGELOG.md` manually, then commit:
```bash
git add CHANGELOG.md
git commit -m "docs: update changelog with additional context"
```

## Troubleshooting

### Common Issues

#### 1. Commit Validation Fails
```bash
# Error: subject may not be empty [subject-empty]
# Solution: Follow conventional commit format
git commit -m "feat: add new feature description"
```

#### 2. Pre-commit Hook Fails
```bash
# Error: TypeScript errors or linting issues
# Solution: Fix issues before committing
pnpm run check-types
pnpm run lint
```

#### 3. Release Workflow Fails
- Check GitHub Actions logs
- Verify secrets are configured
- Ensure main branch protection rules allow semantic-release bot

#### 4. Marketplace Publishing Fails
- Verify `VSCE_PAT` token is valid and has correct permissions
- Check extension manifest validity
- Ensure version number is higher than published version

### Getting Help
- Check [Semantic Release Documentation](https://semantic-release.gitbook.io/)
- Review [Conventional Commits Specification](https://www.conventionalcommits.org/)
- Check GitHub Actions workflow logs for detailed error messages

## Development Scripts

| Command | Description |
|---------|-------------|
| `pnpm run commit` | Interactive conventional commit |
| `pnpm run release` | Manual semantic release |
| `pnpm run check-types` | TypeScript type checking |
| `pnpm run lint` | ESLint code linting |
| `pnpm run package` | Build production extension |
| `npx semantic-release --dry-run` | Test release without publishing |
| `echo "feat: test" \| npx commitlint` | Test commit message validation |

## Release Checklist

Before major releases, verify:

- [ ] All tests pass locally
- [ ] Documentation is up to date
- [ ] Breaking changes are documented
- [ ] GitHub secrets are configured
- [ ] Extension manifest is valid
- [ ] Version dependencies are compatible

## Best Practices

1. **Use descriptive commit messages** that explain the "why" not just the "what"
2. **Group related changes** into single commits when possible
3. **Reference issues** in commit messages using `closes #123` syntax
4. **Test thoroughly** before merging to main branch
5. **Keep commits atomic** - one logical change per commit
6. **Use conventional scopes** consistently (e.g., `feat(parser):`, `fix(ui):`)

## Release History

All releases are tracked in:
- [GitHub Releases](https://github.com/elasticdotventures/just-vscode-extension/releases)
- [CHANGELOG.md](./CHANGELOG.md)
- [VSCode Marketplace History](https://marketplace.visualstudio.com/items?itemName=promptexecution.justlang-lsp)