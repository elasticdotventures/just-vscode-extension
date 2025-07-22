import * as vscode from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';
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

export function createLanguageClient(context: vscode.ExtensionContext): LanguageClient | null {
    const config = vscode.workspace.getConfiguration('justlang-lsp');
    const serverPath = config.get<string>('server.path') || findExecutable('just-lsp');
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

    const serverOptions: ServerOptions = {
        command: serverPath,
        args: [],
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'just' }],
    };

    try {
        console.log('[justlang-lsp] Creating LanguageClient instance...');
        const client = new LanguageClient(
            'justlang-lsp',
            'Just Language Server',
            serverOptions,
            clientOptions
        );
        console.log('[justlang-lsp] LanguageClient instance created.');
        return client;
    } catch (err) {
        vscode.window.showErrorMessage(
            `Failed to create LanguageClient: ${err instanceof Error ? err.message : String(err)}`
        );
        console.error('[justlang-lsp] Failed to create LanguageClient:', err);
        return null;
    }
}
