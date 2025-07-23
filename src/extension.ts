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
    const config = loadCommentedJsonSafe(configPath);
    
    if (config && config.wordPattern && typeof config.wordPattern === 'string') {
        // Convert wordPattern string to RegExp object
        try {
            config.wordPattern = new RegExp(config.wordPattern);
        } catch (error) {
            console.warn('[justlang-lsp] Invalid wordPattern regex:', config.wordPattern, error);
            delete config.wordPattern;
        }
    }
    
    return config;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    console.log('[justlang-lsp] Activation event(s):', (process.env.VSCODE_NLS_CONFIG || 'unknown'));
    console.log('[justlang-lsp] Extension activation started');

    // Read settings for all subsystems
    const config = vscode.workspace.getConfiguration('justlang-lsp');
    let enableLsp = config.get<boolean>('enableLsp', true);
    let enableJustfileWatcher = config.get<boolean>('enableJustfileWatcher', true);
    let enableGrammar = config.get<boolean>('enableGrammar', true);
    let enableTaskProvider = config.get<boolean>('enableTaskProvider', true);
    let logSubsystems = config.get<boolean>('logSubsystems', false);

    // VSCode OutputChannel for extension diagnostics
    const outputChannel = vscode.window.createOutputChannel('justlang-lsp Extension');
    const log = (...args: any[]) => {
        if (logSubsystems) {
            outputChannel.appendLine(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
        }
        // Always log to console for dev
        console.log(...args);
    };

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
        const config = vscode.workspace.getConfiguration('justlang-lsp');
        if (e.affectsConfiguration('justlang-lsp.enableLsp')) {
            const newEnableLsp = config.get<boolean>('enableLsp', true);
            if (newEnableLsp && !client) {
                startLsp();
            } else if (!newEnableLsp && client) {
                stopLsp();
            }
        }
        if (e.affectsConfiguration('justlang-lsp.enableGrammar')) {
            const newEnableGrammar = config.get<boolean>('enableGrammar', true);
            if (newEnableGrammar) {
                // Install grammar checker rules (set language configuration)
                const languageConfig = loadLanguageConfiguration(context);
                if (languageConfig) {
                    log('😸 using languageConfig', languageConfig);
                    vscode.languages.setLanguageConfiguration('just', languageConfig);
                } else {
                    log('😱 WARNING: Using basic internal language config for Just files.');
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
            } else {
                // Remove grammar checker rules (unload language configuration)
                vscode.languages.setLanguageConfiguration('just', {});
                log('[justlang-lsp] Grammar/language configuration subsystem disabled (rules removed)');
            }
        }
    });

    // Initial LSP state
    if (enableLsp) {
        startLsp();
        log('[justlang-lsp] LSP subsystem enabled');
    } else {
        log('[justlang-lsp] LSP subsystem disabled');
    }

    // --- JustTaskProvider and watcher subsystem ---
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot && enableTaskProvider) {
        const justfilePath = path.join(workspaceRoot, 'Justfile');
        const dotJustfilePath = path.join(workspaceRoot, '.justfile');
        const registerProvider = () => {
            log(`[justlang-lsp] Registering JustTaskProvider for workspaceRoot: ${workspaceRoot}`);
            const taskProvider = new JustTaskProvider(workspaceRoot);
            const disposableTaskProvider = vscode.tasks.registerTaskProvider(JustTaskProvider.JustType, taskProvider);
            context.subscriptions.push(disposableTaskProvider);
            log(`[justlang-lsp] JustTaskProvider registered with type: ${JustTaskProvider.JustType}`);
        };
        const fs = require('fs');
        if (fs.existsSync(justfilePath) || fs.existsSync(dotJustfilePath)) {
            registerProvider();
        } else if (enableJustfileWatcher) {
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
            log('[justlang-lsp] Justfile watcher enabled, waiting for any Justfile variant to appear in workspace root...');
        } else {
            log('[justlang-lsp] Justfile watcher subsystem disabled');
        }
    } else if (!enableTaskProvider) {
        log('[justlang-lsp] TaskProvider subsystem disabled');
    } else {
        log('[justlang-lsp] No workspaceRoot found, JustTaskProvider not registered');
    }

    // --- Grammar/language configuration subsystem ---
    if (enableGrammar) {
        // Load language configuration from language-configuration.json
        const languageConfig = loadLanguageConfiguration(context);

        // Set language configuration for Just files using the loaded configuration
        if (languageConfig) {
            log('😸 using languageConfig', languageConfig);
            vscode.languages.setLanguageConfiguration('just', languageConfig);
        } else {
            // Fallback to hardcoded configuration if loading fails
            log('😱 WARNING: Using basic internal language config for Just files.');
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
    } else {
        log('[justlang-lsp] Grammar/language configuration subsystem disabled');
    }

    log('Congratulations, your extension "justlang-lsp" is now active!');
}

// This method is called when your extension is deactivated
export function deactivate() {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
