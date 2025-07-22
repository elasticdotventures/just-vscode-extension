// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { JustTaskProvider } from './task_provider';

/**
 * Loads language configuration from the language-configuration.json file
 */
function loadLanguageConfiguration(context: vscode.ExtensionContext): vscode.LanguageConfiguration | null {
    try {
        const configPath = path.join(context.extensionPath, 'language-configuration.json');
        const configContent = fs.readFileSync(configPath, 'utf8');
        
        // Remove comments from JSON (simple regex approach for this specific case)
        const cleanedContent = configContent
            .replace(/\/\/.*$/gm, '') // Remove line comments
            .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove block comments
        
        const config: vscode.LanguageConfiguration = JSON.parse(cleanedContent);
        return config;
    } catch (error) {
        console.error('Failed to load language configuration:', error);
        return null;
    }
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

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('justlang-lsp.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from justlang-lsp!');
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
