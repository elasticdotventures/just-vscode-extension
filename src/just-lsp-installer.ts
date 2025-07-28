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
            const methods = [
                () => this.installFromLocalBuild(progress),
                () => this.installWithCargo(progress),
                () => this.installFromGitHubReleases(progress)
            ];

            for (const method of methods) {
                if (token.isCancellationRequested) {
                    return { success: false, error: 'Installation cancelled' };
                }

                try {
                    const result = await method();
                    if (result.success) {
                        return result;
                    }
                } catch (error) {
                    logger.errorFromException(error, 'Installation method failed', 'JustLspInstaller');
                }
            }

            return { 
                success: false, 
                error: 'All installation methods failed. Please install just-lsp manually.' 
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
            const fullPath = path.join(p, binaryName);
            if (await this.isExecutable(fullPath)) {
                return fullPath;
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
            await fs.promises.access(filePath, fs.constants.F_OK | fs.constants.X_OK);
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

    private async installWithCargo(progress: vscode.Progress<{message?: string}>): Promise<InstallationResult> {
        progress.report({ message: 'Installing with cargo...' });
        
        try {
            // Check if cargo is available
            await asyncExec('cargo --version');
            
            // Install just-lsp (this will install the original just-lsp from crates.io)
            await asyncExec('cargo install just-lsp');
            
            // Find the installed binary
            const installedPath = await this.findInPath('just-lsp');
            if (installedPath) {
                return { 
                    success: true, 
                    path: installedPath, 
                    method: 'cargo' 
                };
            }
        } catch (error) {
            logger.errorFromException(error, 'Cargo installation failed', 'JustLspInstaller');
        }

        return { success: false, error: 'Cargo installation failed' };
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
        const instructions = `
# Manual Installation Instructions

## Option 1: Install with Cargo (Recommended)
\`\`\`bash
cargo install just-lsp
\`\`\`

## Option 2: Build from source (Development)
\`\`\`bash
git clone https://github.com/elasticdotventures/just-lsp-wasm
cd just-lsp-wasm
cargo build --release
\`\`\`

## Option 3: Download pre-built binary (Future)
Pre-built binaries will be available from GitHub releases in the future.
For now, use Cargo or build from source.

## Configuration
Set the path in VS Code settings:
\`\`\`json
{
  "justlang-lsp.server.path": "/path/to/just-lsp"
}
\`\`\`
`;

        vscode.workspace.openTextDocument({
            content: instructions,
            language: 'markdown'
        }).then(doc => vscode.window.showTextDocument(doc));
    }
}