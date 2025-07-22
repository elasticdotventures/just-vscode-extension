import * as assert from 'assert';
import * as vscode from 'vscode';
import 'mocha';

// --- WorkspaceFolders fixture setup ---
import * as fs from 'fs';
import * as path from 'path';

before(() => {
    // Mock a workspace folder for extension activation using Object.defineProperty
    const mockWorkspaceFolder = {
        uri: { fsPath: '/tmp/test-workspace', path: '/tmp/test-workspace' },
        name: 'test-workspace',
        index: 0
    };
    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        get: () => [mockWorkspaceFolder],
        configurable: true
    });
    console.log('[justlang-lsp test] workspaceFolders fixture set:', vscode.workspace.workspaceFolders);

    // Ensure /tmp/test-workspace exists
    if (!fs.existsSync('/tmp/test-workspace')) {
        fs.mkdirSync('/tmp/test-workspace', { recursive: true });
    }

    // Copy justfile from extension root to workspace
    const sourceJustfile = path.join(__dirname, '../../justfile');
    const destJustfile = path.join('/tmp/test-workspace', 'Justfile');
    if (fs.existsSync(sourceJustfile)) {
        fs.copyFileSync(sourceJustfile, destJustfile);
        console.log(`[justlang-lsp test] Copied Justfile to workspace: ${destJustfile}`);
    } else {
        console.warn(`[justlang-lsp test] Source Justfile not found: ${sourceJustfile}`);
    }
});

describe('😉 Extension Test Suite', () => {
    it('Extension should be active', async () => {
        // DEBUG: If you see this message in test output, extension.test.ts is running!
        console.log("DEBUG: extension.test.ts loaded and running");

        // Log all installed extension IDs for debugging
        const allExts = vscode.extensions.all.map(e => e.id);
        console.log("Installed extensions:", allExts);

        const extension = vscode.extensions.getExtension('promptexecution.justlang-lsp');
        if (!extension) {
            const allExtsStr = vscode.extensions.all.map(e => e.id).join(", ");
            assert.fail(`Extension not found. Installed extensions: ${allExtsStr}`);
        }
        await extension.activate();
        assert.ok(extension.isActive, 'Extension should be active');
    });

    it('Task provider should be registered', async () => {
            console.log('[justlang-lsp test] workspaceFolders:', vscode.workspace.workspaceFolders);
            const extension = vscode.extensions.getExtension('promptexecution.justlang-lsp');
            assert.ok(extension, 'Extension should be found');
            await extension.activate();
            const tasks = await vscode.tasks.fetchTasks({ type: 'just' });
            assert.ok(tasks.length > 0, 'Task provider should be registered and find tasks');
        });

    it('Language configuration should be set', async () => {
        const extension = vscode.extensions.getExtension('promptexecution.justlang-lsp');
        assert.ok(extension, 'Extension should be found');
        await extension.activate();
        const languages = await vscode.languages.getLanguages();
        assert.ok(languages.includes('just'), 'Just language should be registered');
    });
});
