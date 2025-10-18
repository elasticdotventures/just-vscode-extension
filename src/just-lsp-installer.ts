import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { getLogger } from './logger';

const asyncExec = promisify(exec);
const logger = getLogger();

export interface InstallationResult {
    success: boolean;
    path?: string;
    error?: string;
    method?: string;
}

export class JustLspInstaller {
    private static readonly BINARY_NAME = process.platform === 'win32' ? 'just-lsp.exe' : 'just-lsp';
    private static readonly EXPECTED_BINARIES = ['just-lsp', 'just-lsp-ng'];

    /**
     * Check if just-lsp is installed and return its path
     */
    async detectJustLsp(): Promise<string | null> {
        const configPath = vscode.workspace.getConfiguration('justlang-lsp').get<string>('server.path');
        
        // 1. Check explicitly configured path
        if (configPath && await this.isExecutable(configPath)) {
            logger.info(`Found just-lsp at configured path: ${configPath}`, 'JustLspInstaller');
            return configPath;
        }

        // 2. Check PATH for multiple binary names
        for (const binaryName of JustLspInstaller.EXPECTED_BINARIES) {
            const pathResult = await this.findInPath(binaryName);
            if (pathResult) {
                logger.info(`Found ${binaryName} in PATH: ${pathResult}`, 'JustLspInstaller');
                return pathResult;
            }
        }

        // 3. Check common installation locations
        const commonPaths = this.getCommonInstallPaths();
        for (const commonPath of commonPaths) {
            if (await this.isExecutable(commonPath)) {
                logger.info(`Found just-lsp at common location: ${commonPath}`, 'JustLspInstaller');
                return commonPath;
            }
        }

        // 4. Check local development build (relative to extension)
        const devPath = await this.findLocalDevBuild();
        if (devPath) {
            logger.info(`Found local development build: ${devPath}`, 'JustLspInstaller');
            return devPath;
        }

        logger.warning('just-lsp not found in any expected location', 'JustLspInstaller');
        return null;
    }

    /**
     * Install just-lsp using the best available method
     */
    async installJustLsp(): Promise<InstallationResult> {
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Installing just-lsp",
            cancellable: true
        }, async (progress, token) => {
            // Try installation methods in order of preference
            const methods: Array<{name: string, fn: () => Promise<InstallationResult>}> = [
                { name: 'local build', fn: () => this.installFromLocalBuild(progress) },
                { name: 'winget', fn: () => this.installWithWinget(progress) },
                { name: 'cargo', fn: () => this.installWithCargo(progress) },
                { name: 'GitHub releases', fn: () => this.installFromGitHubReleases(progress) }
            ];

            const errors: string[] = [];
            for (const method of methods) {
                if (token.isCancellationRequested) {
                    return { success: false, error: 'Installation cancelled' };
                }

                try {
                    logger.info(`Trying installation method: ${method.name}`, 'JustLspInstaller');
                    const result = await method.fn();
                    if (result.success) {
                        logger.info(`Installation succeeded via ${method.name}`, 'JustLspInstaller');
                        return result;
                    } else {
                        const errMsg = `${method.name}: ${result.error || 'unknown error'}`;
                        errors.push(errMsg);
                        logger.warning(errMsg, 'JustLspInstaller');
                    }
                } catch (error) {
                    const errMsg = `${method.name}: ${error instanceof Error ? error.message : String(error)}`;
                    errors.push(errMsg);
                    logger.errorFromException(error, `Installation method '${method.name}' failed`, 'JustLspInstaller');
                }
            }

            const detailedError = `All installation methods failed:\n${errors.map(e => `  - ${e}`).join('\n')}`;
            logger.error(detailedError, 'JustLspInstaller');
            return {
                success: false,
                error: 'All installation methods failed. Please install just-lsp manually. Check the output log for details.'
            };
        });
    }

    /**
     * Prompt user to install just-lsp if not found
     */
    async promptInstallation(): Promise<boolean> {
        const choice = await vscode.window.showWarningMessage(
            'just-lsp is required but not found. Would you like to install it automatically?',
            'Install Automatically',
            'Install Manually',
            'Cancel'
        );

        switch (choice) {
            case 'Install Automatically':
                const result = await this.installJustLsp();
                if (result.success) {
                    vscode.window.showInformationMessage(
                        `just-lsp installed successfully at: ${result.path}`,
                        'Reload Window'
                    ).then(choice => {
                        if (choice === 'Reload Window') {
                            vscode.commands.executeCommand('workbench.action.reloadWindow');
                        }
                    });
                    return true;
                } else {
                    vscode.window.showErrorMessage(`Installation failed: ${result.error}`);
                    return false;
                }

            case 'Install Manually':
                this.showManualInstallationInstructions();
                return false;

            default:
                return false;
        }
    }

    private async findInPath(binaryName: string): Promise<string | null> {
        const pathVar = process.env.PATH;
        if (!pathVar) {
            return null;
        }

        const pathParts = pathVar.split(path.delimiter);
        for (const p of pathParts) {
            // On Windows, ensure we're looking for .exe if not already specified
            const fullPath = path.join(p, binaryName);
            if (await this.isExecutable(fullPath)) {
                return fullPath;
            }

            // Also try with .exe extension on Windows if not present
            if (process.platform === 'win32' && !binaryName.endsWith('.exe')) {
                const exePath = path.join(p, `${binaryName}.exe`);
                if (await this.isExecutable(exePath)) {
                    return exePath;
                }
            }
        }
        return null;
    }

    private getCommonInstallPaths(): string[] {
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        return [
            path.join(homeDir, '.cargo', 'bin', JustLspInstaller.BINARY_NAME),
            path.join(homeDir, '.local', 'bin', JustLspInstaller.BINARY_NAME),
            path.join('/usr', 'local', 'bin', JustLspInstaller.BINARY_NAME),
            path.join('/usr', 'bin', JustLspInstaller.BINARY_NAME),
            path.join('/opt', 'homebrew', 'bin', JustLspInstaller.BINARY_NAME),
        ];
    }

    private async findLocalDevBuild(): Promise<string | null> {
        // Look for just-lsp-wasm repo relative to this extension
        const extensionPath = path.dirname(__dirname);
        const possiblePaths = [
            path.join(extensionPath, '..', 'just-lsp-wasm', 'target', 'release', JustLspInstaller.BINARY_NAME),
            path.join(extensionPath, '..', 'just-lsp-wasm', 'target', 'debug', JustLspInstaller.BINARY_NAME),
            path.join(extensionPath, '..', '..', 'just-lsp-wasm', 'target', 'release', JustLspInstaller.BINARY_NAME),
            path.join(extensionPath, '..', '..', 'just-lsp-wasm', 'target', 'debug', JustLspInstaller.BINARY_NAME),
        ];

        for (const devPath of possiblePaths) {
            if (await this.isExecutable(devPath)) {
                return devPath;
            }
        }
        return null;
    }

    private async isExecutable(filePath: string): Promise<boolean> {
        try {
            // On Windows, just check if file exists and is a file
            // X_OK doesn't work reliably on Windows
            const stat = await fs.promises.stat(filePath);
            if (!stat.isFile()) {
                return false;
            }

            // On Windows, we trust the file extension for executability
            if (process.platform === 'win32') {
                return filePath.endsWith('.exe') || filePath.endsWith('.cmd') || filePath.endsWith('.bat');
            }

            // On Unix, check execute permission
            await fs.promises.access(filePath, fs.constants.X_OK);
            return true;
        } catch {
            return false;
        }
    }

    private async installFromLocalBuild(progress: vscode.Progress<{message?: string}>): Promise<InstallationResult> {
        progress.report({ message: 'Building from local source...' });
        
        const extensionPath = path.dirname(__dirname);
        const possibleRepos = [
            path.join(extensionPath, '..', 'just-lsp-wasm'),
            path.join(extensionPath, '..', '..', 'just-lsp-wasm'),
        ];

        for (const repoPath of possibleRepos) {
            if (fs.existsSync(path.join(repoPath, 'Cargo.toml'))) {
                try {
                    progress.report({ message: 'Building just-lsp from local source...' });
                    await asyncExec('cargo build --release', { cwd: repoPath });
                    
                    const binaryPath = path.join(repoPath, 'target', 'release', JustLspInstaller.BINARY_NAME);
                    if (await this.isExecutable(binaryPath)) {
                        return { 
                            success: true, 
                            path: binaryPath, 
                            method: 'local-build' 
                        };
                    }
                } catch (error) {
                    logger.errorFromException(error, 'Local build failed', 'JustLspInstaller');
                }
            }
        }

        return { success: false, error: 'Local source not found or build failed' };
    }

    private async installWithWinget(progress: vscode.Progress<{message?: string}>): Promise<InstallationResult> {
        // Only attempt on Windows
        if (process.platform !== 'win32') {
            return { success: false, error: 'Winget is only available on Windows' };
        }

        try {
            // Check if winget is available
            logger.info('Checking for winget...', 'JustLspInstaller');
            await asyncExec('winget --version');
            logger.info('Winget is available', 'JustLspInstaller');
        } catch (error) {
            logger.info('Winget not available, skipping', 'JustLspInstaller');
            return {
                success: false,
                error: 'Winget not available on this system'
            };
        }

        // just-lsp is not currently available in winget
        // Instead, offer to install Rust/Cargo which is needed for cargo install
        logger.info('just-lsp not available in winget, checking for cargo...', 'JustLspInstaller');

        try {
            // Check if cargo is already installed
            await asyncExec('cargo.exe --version');
            logger.info('Cargo already installed, skipping winget method', 'JustLspInstaller');
            return {
                success: false,
                error: 'Cargo already available, will try cargo installation instead'
            };
        } catch (error) {
            // Cargo not installed, offer to install it via winget
            logger.info('Cargo not found, offering to install via winget', 'JustLspInstaller');

            const choice = await vscode.window.showInformationMessage(
                'just-lsp requires Rust and Cargo to install. Would you like to install Rust via winget?',
                'Install Rust with winget',
                'Skip'
            );

            if (choice === 'Install Rust with winget') {
                try {
                    progress.report({ message: 'Installing Rust via winget...' });
                    await asyncExec('winget install --id Rustlang.Rust.MSVC --accept-source-agreements --accept-package-agreements', {
                        timeout: 600000, // 10 minutes
                        maxBuffer: 10 * 1024 * 1024
                    });

                    vscode.window.showInformationMessage(
                        'Rust installed successfully. Please restart VS Code and try installing just-lsp again.',
                        'Reload Window'
                    ).then(choice => {
                        if (choice === 'Reload Window') {
                            vscode.commands.executeCommand('workbench.action.reloadWindow');
                        }
                    });

                    return {
                        success: false,
                        error: 'Rust installed, but VS Code needs to be reloaded. Please try installing just-lsp again after reload.'
                    };
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    logger.errorFromException(error, 'Failed to install Rust via winget', 'JustLspInstaller');
                    return {
                        success: false,
                        error: `Failed to install Rust via winget: ${errorMsg}`
                    };
                }
            } else {
                return {
                    success: false,
                    error: 'User declined to install Rust via winget'
                };
            }
        }
    }

    private async installWithCargo(progress: vscode.Progress<{message?: string}>): Promise<InstallationResult> {
        progress.report({ message: 'Installing with cargo...' });

        try {
            // Check if cargo is available
            logger.info('Checking for cargo...', 'JustLspInstaller');
            const cargoCheckCmd = process.platform === 'win32' ? 'cargo.exe --version' : 'cargo --version';
            const { stdout: cargoVersion } = await asyncExec(cargoCheckCmd);
            logger.info(`Found cargo: ${cargoVersion.trim()}`, 'JustLspInstaller');

            // Install just-lsp (this will install the original just-lsp from crates.io)
            progress.report({ message: 'Running cargo install just-lsp (this may take several minutes)...' });
            logger.info('Running cargo install just-lsp...', 'JustLspInstaller');

            const installCmd = process.platform === 'win32' ? 'cargo.exe install just-lsp' : 'cargo install just-lsp';
            const { stdout: installOutput } = await asyncExec(installCmd, {
                timeout: 600000, // 10 minutes timeout for compilation
                maxBuffer: 10 * 1024 * 1024 // 10MB buffer for output
            });
            logger.info(`Cargo install output: ${installOutput}`, 'JustLspInstaller');

            // Find the installed binary - check both with and without .exe
            const binaryName = process.platform === 'win32' ? 'just-lsp.exe' : 'just-lsp';
            let installedPath = await this.findInPath(binaryName);

            // Also check the .cargo/bin directory directly
            if (!installedPath) {
                const homeDir = process.env.HOME || process.env.USERPROFILE || '';
                const cargoBinPath = path.join(homeDir, '.cargo', 'bin', binaryName);
                if (await this.isExecutable(cargoBinPath)) {
                    installedPath = cargoBinPath;
                }
            }

            if (installedPath) {
                logger.info(`Successfully installed just-lsp at: ${installedPath}`, 'JustLspInstaller');
                return {
                    success: true,
                    path: installedPath,
                    method: 'cargo'
                };
            } else {
                return {
                    success: false,
                    error: 'Cargo install completed but binary not found in PATH or .cargo/bin'
                };
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.errorFromException(error, 'Cargo installation failed', 'JustLspInstaller');

            // Check if this is a linker error indicating missing Visual Studio Build Tools
            if (errorMsg.includes('link.exe') && errorMsg.includes('Visual Studio build tools')) {
                if (process.platform === 'win32') {
                    const choice = await vscode.window.showErrorMessage(
                        'Rust compilation requires Visual Studio Build Tools with C++ support. Would you like to install them?',
                        'Install Build Tools',
                        'Manual Instructions',
                        'Cancel'
                    );

                    if (choice === 'Install Build Tools') {
                        try {
                            // Try using winget to install Visual Studio Build Tools
                            await asyncExec('winget install --id Microsoft.VisualStudio.2022.BuildTools --accept-source-agreements --accept-package-agreements', {
                                timeout: 600000 // 10 minutes
                            });

                            vscode.window.showInformationMessage(
                                'Visual Studio Build Tools installed. Please restart VS Code and try installing just-lsp again.',
                                'Reload Window'
                            ).then(choice => {
                                if (choice === 'Reload Window') {
                                    vscode.commands.executeCommand('workbench.action.reloadWindow');
                                }
                            });

                            return {
                                success: false,
                                error: 'Visual Studio Build Tools installed. Please reload VS Code and retry installation.'
                            };
                        } catch (installError) {
                            vscode.window.showErrorMessage(
                                'Failed to install Build Tools automatically. Please install manually.',
                                'Open Instructions'
                            ).then(choice => {
                                if (choice === 'Open Instructions') {
                                    vscode.env.openExternal(vscode.Uri.parse('https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022'));
                                }
                            });
                        }
                    } else if (choice === 'Manual Instructions') {
                        vscode.env.openExternal(vscode.Uri.parse('https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022'));
                    }
                }

                return {
                    success: false,
                    error: 'Missing Visual Studio Build Tools with C++ support. Required for compiling Rust programs on Windows.'
                };
            }

            return {
                success: false,
                error: `Cargo installation failed: ${errorMsg}`
            };
        }
    }

    private async installFromGitHubReleases(progress: vscode.Progress<{message?: string}>): Promise<InstallationResult> {
        progress.report({ message: 'Downloading from GitHub releases...' });
        
        // This would require implementing GitHub API calls and binary downloads
        // For now, return failure and suggest manual installation
        return { 
            success: false, 
            error: 'GitHub releases installation not yet implemented' 
        };
    }


    private showManualInstallationInstructions(): void {
        const isWindows = process.platform === 'win32';
        const isMac = process.platform === 'darwin';
        const isLinux = process.platform === 'linux';

        let instructions = `# Manual Installation Instructions for just-lsp

**Note**: This extension requires the \`just-lsp\` language server (separate from the \`just\` command runner).

`;

        if (isWindows) {
            instructions += `
## Windows Installation

### Prerequisites
**IMPORTANT**: Rust on Windows requires Visual Studio Build Tools with C++ support.

Install build tools:
\`\`\`powershell
# Option A: Install via winget
winget install Microsoft.VisualStudio.2022.BuildTools

# Option B: Download manually from:
# https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
# Make sure to select "Desktop development with C++" workload
\`\`\`

### Option 1: Install with Cargo (Recommended)
\`\`\`powershell
# If you don't have Rust/Cargo installed:
winget install Rustlang.Rust.MSVC

# Install just-lsp:
cargo install just-lsp
\`\`\`

### Option 2: Install just command runner (Optional)
If you also want the \`just\` command runner:
\`\`\`powershell
winget install casey.just
\`\`\`

### Option 3: Build from source
\`\`\`powershell
git clone https://github.com/elasticdotventures/just-lsp-wasm
cd just-lsp-wasm
cargo build --release
\`\`\`
`;
        } else if (isMac) {
            instructions += `
## macOS Installation

### Option 1: Install with Cargo (Recommended)
\`\`\`bash
# If you don't have Rust/Cargo installed:
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install just-lsp:
cargo install just-lsp
\`\`\`

### Option 2: Install just command runner with Homebrew (Optional)
If you also want the \`just\` command runner:
\`\`\`bash
brew install just
\`\`\`

### Option 3: Build from source
\`\`\`bash
git clone https://github.com/elasticdotventures/just-lsp-wasm
cd just-lsp-wasm
cargo build --release
\`\`\`
`;
        } else if (isLinux) {
            instructions += `
## Linux Installation

### Option 1: Install with Cargo (Recommended)
\`\`\`bash
# If you don't have Rust/Cargo installed:
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install just-lsp:
cargo install just-lsp
\`\`\`

### Option 2: Install just command runner (Optional)
If you also want the \`just\` command runner:
\`\`\`bash
# Ubuntu/Debian
sudo apt install just

# Arch Linux
sudo pacman -S just

# Or use cargo
cargo install just
\`\`\`

### Option 3: Build from source
\`\`\`bash
git clone https://github.com/elasticdotventures/just-lsp-wasm
cd just-lsp-wasm
cargo build --release
\`\`\`
`;
        }

        instructions += `
## Configuration
After installation, you can specify the path in VS Code settings:
\`\`\`json
{
  "justlang-lsp.server.path": "${isWindows ? 'C:\\\\Users\\\\YourName\\\\.cargo\\\\bin\\\\just-lsp.exe' : '~/.cargo/bin/just-lsp'}"
}
\`\`\`

## Troubleshooting
- Make sure the just-lsp binary is in your PATH
- On Windows, you may need to restart VS Code after installation
- Check the "Just Language Server" output panel for error messages
`;

        vscode.workspace.openTextDocument({
            content: instructions,
            language: 'markdown'
        }).then(doc => vscode.window.showTextDocument(doc));
    }
}