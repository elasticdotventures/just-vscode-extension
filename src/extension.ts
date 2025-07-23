import * as vscode from 'vscode';
import * as path from 'path';
import { JustTaskProvider } from './task_provider';
import { loadCommentedJsonSafe } from './utils/json-loader';
import { createLanguageClient } from './client';
import { LanguageClient } from 'vscode-languageclient/node';

let client: LanguageClient | null;

/**
 * Loads language configuration from the language-configuration.json file
 */
function loadLanguageConfiguration(context: vscode.ExtensionContext): vscode.LanguageConfiguration | null {
    const configPath = path.join(context.extensionPath, 'language-configuration.json');
    return loadCommentedJsonSafe(configPath);
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    console.log('[justlang-lsp] Activation event(s):', (process.env.VSCODE_NLS_CONFIG || 'unknown'));
    console.log('[justlang-lsp] Extension activation started');

    // Read enableLsp setting
    const config = vscode.workspace.getConfiguration('justlang-lsp');
    let enableLsp = config.get<boolean>('enableLsp', true);

    // Function to start the LSP client
    const startLsp = async () => {
        if (client) {
            console.log('[justlang-lsp] LSP client already running. Stopping previous client before starting a new one.');
            await stopLsp();
        }
        console.log('[justlang-lsp] Creating language client...');
        client = createLanguageClient(context);
        if (client) {
            console.log('[justlang-lsp] Language client created, starting...');
            try {
                const startPromise = client.start();
                setTimeout(() => {
                    if (client && client.isRunning()) {
                        console.log('[justlang-lsp] Language client is running.');
                    } else {
                        console.error('[justlang-lsp] Language client did not become ready within 10 seconds (timeout).');
                        console.error('[justlang-lsp] Client state:', client?.state);
                        vscode.window.showErrorMessage('justlang-lsp language server startup timed out.');
                    }
                }, 10000);
                if (startPromise && typeof startPromise.then === 'function') {
                    startPromise.then(() => {
                        console.log('[justlang-lsp] Language client started successfully.');
                        console.log('[justlang-lsp] Client state:', client?.state);
                    }).catch((err: unknown) => {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        const errorStack = err instanceof Error ? err.stack : 'No stack trace available';
                        console.error('[justlang-lsp] Language client failed to start:', {
                            message: errorMessage,
                            stack: errorStack,
                            clientState: client?.state
                        });
                        vscode.window.showErrorMessage(`justlang-lsp language client failed to start: ${errorMessage}`);
                    });
                }
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                const errorStack = err instanceof Error ? err.stack : 'No stack trace available';
                console.error('[justlang-lsp] Exception during client.start():', {
                    message: errorMessage,
                    stack: errorStack
                });
                vscode.window.showErrorMessage(`Exception starting justlang-lsp: ${errorMessage}`);
            }
        } else {
            console.error('[justlang-lsp] Language client creation failed (client is null)');
            vscode.window.showErrorMessage('justlang-lsp language client creation failed.');
        }
    };

    // Function to stop the LSP client
    const stopLsp = async () => {
        if (client) {
            console.log('[justlang-lsp] Stopping language client...');
            try {
                await client.stop();
            } catch (e) {
                console.error('[justlang-lsp] Error stopping language client:', e);
            }
            client = null;
        }
    };

    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('justlang-lsp.enableLsp')) {
            const newEnableLsp = vscode.workspace.getConfiguration('justlang-lsp').get<boolean>('enableLsp', true);
            if (newEnableLsp && !client) {
                startLsp();
            } else if (!newEnableLsp && client) {
                stopLsp();
            }
        }
    });

    // Initial LSP state
    if (enableLsp) {
        startLsp();
    }

    // --- Existing JustTaskProvider and language config logic below ---

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot) {
        const justfilePath = path.join(workspaceRoot, 'Justfile');
        const dotJustfilePath = path.join(workspaceRoot, '.justfile');
        const registerProvider = () => {
            console.log(`[justlang-lsp] Registering JustTaskProvider for workspaceRoot: ${workspaceRoot}`);
            const taskProvider = new JustTaskProvider(workspaceRoot);
            const disposableTaskProvider = vscode.tasks.registerTaskProvider(JustTaskProvider.JustType, taskProvider);
            context.subscriptions.push(disposableTaskProvider);
            console.log(`[justlang-lsp] JustTaskProvider registered with type: ${JustTaskProvider.JustType}`);
        };
        const fs = require('fs');
        if (fs.existsSync(justfilePath) || fs.existsSync(dotJustfilePath)) {
            registerProvider();
        } else {
            // Watch for creation of Justfile or .justfile and register provider when found
            // Watch for all Justfile types, case-insensitive
            const pattern = '{[Jj]ustfile,[Jj]ustfile,[Jj]ust,[Jj]ust,.justfile,.just,*.just,*.justfile}';
            const watcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(workspaceRoot, pattern), false, false, false
            );
            watcher.onDidCreate(() => {
                registerProvider();
                watcher.dispose();
            });
            context.subscriptions.push(watcher);
            console.log('[justlang-lsp] Waiting for any Justfile variant to appear in workspace root...');
        }
    } else {
        console.warn('[justlang-lsp] No workspaceRoot found, JustTaskProvider not registered');
    }

    // Load language configuration from language-configuration.json
    const languageConfig = loadLanguageConfiguration(context);

    // Set language configuration for Just files using the loaded configuration
    if (languageConfig) {
        console.warn('😸 using languageConfig', languageConfig);
        vscode.languages.setLanguageConfiguration('just', languageConfig);
    } else {
        // Fallback to hardcoded configuration if loading fails
        // TODO: log this fallback
        console.warn('😱 WARNING: Using basic internal language config for Just files.');
        vscode.languages.setLanguageConfiguration('just', {
            comments: {
                lineComment: '#',
            },
            brackets: [['(', ')']],
            autoClosingPairs: [
                { open: '{', close: '}' },
                { open: '[', close: ']' },
                { open: '(', close: ')' },
                { open: '"', close: '"' },
                { open: "'", close: "'" },
            ],
        });
    }

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "justlang-lsp" is now active!');
}

// This method is called when your extension is deactivated
export function deactivate() {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
