import * as vscode from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, ErrorAction, CloseAction } from 'vscode-languageclient/node';
import * as path from 'path';
import * as fs from 'fs';

function findExecutable(bin: string): string | null {
    const pathVar = process.env.PATH;
    if (!pathVar) {
        return null;
    }
    const pathParts = pathVar.split(path.delimiter);
    for (const p of pathParts) {
        const exe = path.join(p, bin);
        if (fs.existsSync(exe)) {
            return exe;
        }
    }
    return null;
}

// runs the justlsp binary 
export function createLanguageClient(context: vscode.ExtensionContext): LanguageClient | null {
    const config = vscode.workspace.getConfiguration('justlang-lsp');

    // Find the binary
    const serverPath = config.get<string>('server.path') || findExecutable('just-lsp');
    
    // Check if debug logging is enabled (force enable during tests)
    const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.VSCODE_TEST === '1';
    const debugEnabled = isTestEnvironment || config.get<boolean>('debug.enabled', false);

    // Check if the just-lsp binary is executable
    try {
        if (serverPath && fs.existsSync(serverPath)) {
            fs.accessSync(serverPath, fs.constants.X_OK);
        } else {
            throw new Error('just-lsp binary not found');
        }
    } catch (err) {
        vscode.window.showErrorMessage(
            `just-lsp binary at ${serverPath} is not executable: ${err instanceof Error ? err.message : String(err)}`
        );
        console.error(`[justlang-lsp] just-lsp binary at ${serverPath} is not executable:`, err);
        return null;
    }

    if (!serverPath) {
        vscode.window.showErrorMessage(
            'just-lsp executable not found. Please specify the path in your settings or ensure it is in your PATH.'
        );
        return null;
    }

    console.log(`[justlang-lsp] Found just-lsp executable at: ${serverPath}`);
    console.log('[justlang-lsp] Preparing to launch language server process...');

    // Prepare server arguments
    const args: string[] = [];
    
    // Add debug logging if enabled
    if (debugEnabled) {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceRoot) {
            const logPath = path.join(workspaceRoot, 'justlang_lsp.log');
            args.push('--log', logPath);
            console.log(`[justlang-lsp] Debug logging enabled, writing to: ${logPath}`);
        } else {
            console.warn('[justlang-lsp] Debug logging enabled but no workspace folder found');
        }
    } else {
        console.log('[justlang-lsp] Debug logging disabled');
    }

    const serverOptions: ServerOptions = {
        command: serverPath,
        args: args,
        options: {
            env: process.env
        }
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'just' }],
        outputChannelName: 'Just Language Server',
        initializationOptions: {},
        // Enable all LSP capabilities
        synchronize: {
            fileEvents: vscode.workspace.createFileSystemWatcher('**/*.{just,justfile,Justfile}')
        },
        // Enhanced error handling
        errorHandler: {
            error: (error, message, count) => {
                console.error(`[justlang-lsp] LSP Error (${count}):`, error, message);
                return { action: ErrorAction.Continue };
            },
            closed: () => {
                console.warn('[justlang-lsp] LSP connection closed');
                return { action: CloseAction.Restart };
            }
        }
    };

    try {
        console.log('[justlang-lsp] Creating LanguageClient instance...');
        // console.log('[justlang-lsp] Server options:', JSON.stringify(serverOptions, null, 2));
        
        
        console.log('[justlang-lsp] Client options:', JSON.stringify(clientOptions, null, 2));
        
        const client = new LanguageClient(
            'justlang-lsp',
            'Just Language Server',
            serverOptions,
            clientOptions
        );
        console.log('[justlang-lsp] LanguageClient instance created.');
        
        // Add event listeners for better debugging
        client.onDidChangeState((event) => {
            console.log(`[justlang-lsp] Client state changed: ${event.oldState} -> ${event.newState}`);
        });

        client.onNotification('window/logMessage', (params) => {
            console.log(`[justlang-lsp] Server log: ${params.message}`);
        });

        client.onNotification('window/showMessage', (params) => {
            console.log(`[justlang-lsp] Server message: ${params.message}`);
        });

        // Handle server-to-client commands
        client.onRequest('workspace/executeCommand', async (params) => {
            console.log(`[justlang-lsp] Execute command request: ${params.command}`, params.arguments);
            try {
                const result = await vscode.commands.executeCommand(params.command, ...(params.arguments || []));
                return result;
            } catch (error) {
                console.error(`[justlang-lsp] Command execution failed:`, error);
                throw error;
            }
        });
        
        return client;
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const errorStack = err instanceof Error ? err.stack : 'No stack trace available';
        
        vscode.window.showErrorMessage(
            `Failed to create LanguageClient: ${errorMessage}`
        );
        console.error('[justlang-lsp] Failed to create LanguageClient:', {
            message: errorMessage,
            stack: errorStack,
            serverOptions,
            clientOptions
        });
        return null;
    }
}
