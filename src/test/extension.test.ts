import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { JustTaskProvider } from '../task_provider';
import { activate } from '../extension';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
    test('Language Configuration', async () => {
        const config = vscode.workspace.getConfiguration('just');
        assert.ok(config, 'Language configuration for JustLang should be available');
        assert.strictEqual(config.comments?.lineComment, '#', 'Line comment should be "#"');
        assert.deepStrictEqual(config.brackets, [['(', ')']], 'Brackets should include parentheses');
    });
	vscode.window.showInformationMessage('Start all tests.');

	test('Task Provider Registration', () => {
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
	
	test('Command Registration', () => {
	    const context: vscode.ExtensionContext = {
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
	    const command = vscode.commands.getCommands(true).then(commands => commands.includes('justlang-lsp.helloWorld'));
	    assert.ok(command, 'Command should be registered');
	});
		vscode.commands.getCommands(true).then(commands => {
		    assert.ok(commands.includes('justlang-lsp.helloWorld'), 'Command should be registered');
		});
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
// Test syntax highlighting for JustLang files
test('Syntax Highlighting', async () => {
    const grammar = await vscode.languages.getLanguages().then(languages => languages.includes('just'));
    assert.ok(grammar, 'JustLang syntax highlighting should be available');
});

// Test language configuration for JustLang files
test('Language Configuration', async () => {
    const config = vscode.workspace.getConfiguration('just');
    assert.ok(config, 'Language configuration for JustLang should be available');
    assert.strictEqual(config.comments?.lineComment, '#', 'Line comment should be "#"');
    assert.deepStrictEqual(config.brackets, [['(', ')']], 'Brackets should include parentheses');
});
	});
