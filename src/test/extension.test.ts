// Attribution: Portions of this file are derived from the `vscode-syntax-highlighting-just` repository.
// Repository URL: https://codeberg.org/wolfmah/vscode-syntax-highlighting-just/

const assert = require('assert');
const vscode = require('vscode');
const { JustTaskProvider } = require('../task_provider');
const { activate } = require('../extension');

describe('Extension Test Suite', () => {
    it('Language Configuration', async () => {
        const config = vscode.workspace.getConfiguration('just');
        assert.ok(config, 'Language configuration for JustLang should be available');
        console.log('Language Configuration:', JSON.stringify(config, null, 2));
        assert.strictEqual(config.comments?.lineComment, '#', 'Line comment should be "#"');
        assert.deepStrictEqual(config.brackets, [['(', ')']], 'Brackets should include parentheses');
    });

    it('Task Provider Registration', () => {
        let workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            const tempWorkspaceRoot = '/tmp/test-workspace';
            try {
                require('fs').mkdirSync(tempWorkspaceRoot, { recursive: true });
                console.log(`Temporary workspace root created at ${tempWorkspaceRoot}`);
                workspaceRoot = tempWorkspaceRoot;
            } catch (error) {
                throw new Error('Failed to create a temporary workspace root for testing.');
            }
        }
        assert.ok(workspaceRoot, 'Workspace root should exist');

        const taskProvider = new JustTaskProvider(workspaceRoot!);
        const disposableTaskProvider = vscode.tasks.registerTaskProvider(JustTaskProvider.JustType, taskProvider);
        assert.ok(disposableTaskProvider, 'Task provider should be registered');
    });

    it('Command Registration', () => {
        const context = {
            subscriptions: [],
            workspaceState: {} as any,
            globalState: {} as any,
            extensionUri: vscode.Uri.file(''),
            extensionPath: '',
            environmentVariableCollection: {} as any,
            storageUri: vscode.Uri.file(''),
            globalStorageUri: vscode.Uri.file(''),
            logUri: vscode.Uri.file(''),
            secrets: {} as any,
            extensionMode: vscode.ExtensionMode.Test,
            extension: {} as any,
            asAbsolutePath: (path: string) => path,
            storagePath: '',
            globalStoragePath: '',
            logPath: '',
            languageModelAccessInformation: {} as any
        };

        activate(context);
        const command = vscode.commands.getCommands(true).then((commands: string[]) => commands.includes('justlang-lsp.helloWorld'));
        assert.ok(command, 'Command should be registered');
    });

    it('Syntax Highlighting', async () => {
        const grammar = await vscode.languages.getLanguages().then((languages: string[]) => languages.includes('just'));
        assert.ok(grammar, 'JustLang syntax highlighting should be available');
    });

    it('Language Configuration File Accessibility', async () => {
        const fs = require('fs');
        const path = require('path');
        const configPath = path.resolve(__dirname, '../../language-configuration.json');
        const fileExists = fs.existsSync(configPath);
        assert.ok(fileExists, 'Language configuration file should be accessible');
    });
});
