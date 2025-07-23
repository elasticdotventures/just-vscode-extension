import * as assert from 'assert';
import * as vscode from 'vscode';
import 'mocha';

// --- WorkspaceFolders fixture setup ---
import * as fs from 'fs';
import * as path from 'path';

before(() => {
    // Set test environment variables to force debug logging
    process.env.NODE_ENV = 'test';
    process.env.VSCODE_TEST = '1';
    
    // Mock a workspace folder for extension activation using Object.defineProperty
    const mockWorkspaceFolder = {
        uri: vscode.Uri.file('/tmp/test-workspace'),
        name: 'test-workspace',
        index: 0
    };
    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        get: () => [mockWorkspaceFolder],
        configurable: true
    });
    console.log('[justlang-lsp test] workspaceFolders fixture set:', vscode.workspace.workspaceFolders);

    // Mock workspace configuration to force debug.enabled = true during tests
    const originalGetConfiguration = vscode.workspace.getConfiguration;
    vscode.workspace.getConfiguration = (section?: string) => {
        const config = originalGetConfiguration(section);
        if (section === 'justlang-lsp') {
            // Create a new object with our custom get method
            const originalGet = config.get.bind(config);
            return {
                ...config,
                get: (key: string, defaultValue?: any) => {
                    if (key === 'debug.enabled') {
                        console.log('[justlang-lsp test] Forcing debug.enabled = true for tests');
                        return true;
                    }
                    return originalGet(key, defaultValue);
                }
            };
        }
        return config;
    };

    // Ensure /tmp/test-workspace exists
    if (!fs.existsSync('/tmp/test-workspace')) {
        fs.mkdirSync('/tmp/test-workspace', { recursive: true });
    }
    
    // Clear any existing debug log file before tests run
    const logPath = path.join('/tmp/test-workspace', 'justlang_lsp.log');
    if (fs.existsSync(logPath)) {
        fs.unlinkSync(logPath);
        console.log('[justlang-lsp test] Cleared existing debug log file');
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
        // console.log("DEBUG: extension.test.ts loaded and running");

        // Log all installed extension IDs for debugging
        const allExts = vscode.extensions.all.map(e => e.id);
        // console.log("Installed extensions:", allExts);

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
            
            // Add delay to allow task provider to register and discover tasks
            console.log('[justlang-lsp test] Waiting for task provider to discover tasks...');
            await new Promise(resolve => setTimeout(resolve, 5000));
// Extra debug: run "just -l" manually and print output
const cp = require('child_process');
try {
    const { stdout, stderr } = cp.spawnSync('just', ['-l'], { cwd: '/tmp/test-workspace', encoding: 'utf-8' });
    console.log('[justlang-lsp test] Manual just -l stdout:\n', stdout);
    console.log('[justlang-lsp test] Manual just -l stderr:\n', stderr);
} catch (err) {
    console.error('[justlang-lsp test] Error running just -l manually:', err);
}
            
            console.log('[justlang-lsp test] Fetching just tasks...');
            const tasks = await vscode.tasks.fetchTasks({ type: 'just' });
            console.log(`[justlang-lsp test] 🧩 Found ${tasks.length} just tasks:`, tasks.map(t => t.name));

            const tasks2 = await vscode.tasks.fetchTasks({ type: 'justlang' });
            console.log(`[justlang-lsp test] 🧩 Found ${tasks2.length} justlang tasks:`, tasks2.map(t => t.name));

            const tasks3 = await vscode.tasks.fetchTasks({ type: 'justlang-lsp' }); 
            console.log(`[justlang-lsp test] 🧩 Found ${tasks3.length} justlang-lsp tasks:`, tasks3.map(t => t.name));

            // Define a sample task filter, e.g., for tasks of type 'just'
            
            // Also try fetching all tasks to see what's available
            const allTasks = await vscode.tasks.fetchTasks();
            console.log(`[justlang-lsp test] Found ${allTasks.length} total tasks:`, allTasks.map(t => `${t.source}:${t.name}`));
            console.log('[justlang-lsp test] All tasks:', allTasks);
            
            assert.ok(tasks.length > 0, `Task provider should be registered and find tasks. Found ${tasks.length} just tasks out of ${allTasks.length} total tasks.`);
        });

    it('Language configuration should be set', async () => {
        const extension = vscode.extensions.getExtension('promptexecution.justlang-lsp');
        assert.ok(extension, 'Extension should be found');
        await extension.activate();
        const languages = await vscode.languages.getLanguages();
        assert.ok(languages.includes('just'), 'Just language should be registered');
    });

    it('Debug log file should be created during tests', async () => {
        const extension = vscode.extensions.getExtension('promptexecution.justlang-lsp');
        assert.ok(extension, 'Extension should be found');
        await extension.activate();
        
        // Add delay to allow language server to start and create log file
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const logPath = path.join('/tmp/test-workspace', 'justlang_lsp.log');
        console.log(`[justlang-lsp test] Checking for log file at: ${logPath}`);
        
        const logExists = fs.existsSync(logPath);
        if (logExists) {
            const logContent = fs.readFileSync(logPath, 'utf8');
            console.log(`[justlang-lsp test] Log file content:\n${logContent}`);
        } else {
            console.log('[justlang-lsp test] Log file does not exist');
        }
        
        assert.ok(logExists, 'Debug log file should be created during tests');
    });
});
