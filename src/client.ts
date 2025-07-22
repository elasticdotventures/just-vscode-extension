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

    if (!serverPath) {
        vscode.window.showErrorMessage(
            'just-lsp executable not found. Please specify the path in your settings or ensure it is in your PATH.'
        );
        return null;
    }

    console.log(`Found just-lsp executable at: ${serverPath}`);

    const serverOptions: ServerOptions = {
        command: serverPath,
        args: [],
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'just' }],
    };

    return new LanguageClient(
        'justlang-lsp',
        'Just Language Server',
        serverOptions,
        clientOptions
    );
}
