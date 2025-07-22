import * as assert from 'assert';
import * as vscode from 'vscode';
import 'mocha';

describe('Language Client', () => {
    it('Should create the language client', async () => {
        const extension = vscode.extensions.getExtension('justlang-lsp.justlang-lsp');
        assert.ok(extension, 'Extension should be found');
        await extension.activate();

        // The extension should be active, and the client should have been created.
        // We can't access the client directly, but we can check that the extension activated successfully.
        assert.ok(extension.isActive, 'Extension should be active');
    });
});
