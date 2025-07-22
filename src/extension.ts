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
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot) {
        const taskProvider = new JustTaskProvider(workspaceRoot);
        const disposableTaskProvider = vscode.tasks.registerTaskProvider(JustTaskProvider.JustType, taskProvider);
        context.subscriptions.push(disposableTaskProvider);
    }

    // Load language configuration from language-configuration.json
    const languageConfig = loadLanguageConfiguration(context);
    
    // Set language configuration for Just files using the loaded configuration
    if (languageConfig) {
        vscode.languages.setLanguageConfiguration('just', languageConfig);
    } else {
        // Fallback to hardcoded configuration if loading fails
        // TODO: log this fallback
        console.warn('😱 Using fallback language configuration for Just files.');
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

    client = createLanguageClient(context);

    if (client) {
        client.start();
    }
}

// This method is called when your extension is deactivated
export function deactivate() {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
