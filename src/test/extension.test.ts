import * as assert from 'assert';
import * as vscode from 'vscode';
import 'mocha';

describe('Extension Test Suite', () => {
    it('Extension should be active', async () => {
        const extension = vscode.extensions.getExtension('justlang-lsp.justlang-lsp');
        assert.ok(extension, 'Extension should be found');
        await extension.activate();
        assert.ok(extension.isActive, 'Extension should be active');
    });

    it('Task provider should be registered', async () => {
        const extension = vscode.extensions.getExtension('justlang-lsp.justlang-lsp');
        assert.ok(extension, 'Extension should be found');
        await extension.activate();
        const tasks = await vscode.tasks.fetchTasks({ type: 'just' });
        assert.ok(tasks.length > 0, 'Task provider should be registered and find tasks');
    });

    it('Language configuration should be set', async () => {
        const extension = vscode.extensions.getExtension('justlang-lsp.justlang-lsp');
        assert.ok(extension, 'Extension should be found');
        await extension.activate();
        const languages = await vscode.languages.getLanguages();
        assert.ok(languages.includes('just'), 'Just language should be registered');
    });
});
