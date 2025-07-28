import * as vscode from 'vscode';
import * as path from 'path';
import { JustTaskProvider } from './task_provider';
import { loadCommentedJsonSafe } from './utils/json-loader';
import { createLanguageClient } from './client';
import { registerCommands } from './commands';
import { LanguageClient } from 'vscode-languageclient/node';
import { getLogger } from './logger';

let client: LanguageClient | null;
const logger = getLogger();

function loadLanguageConfiguration(context: vscode.ExtensionContext): vscode.LanguageConfiguration | null {
    const configPath = path.join(context.extensionPath, 'language-configuration.json');
    const config = loadCommentedJsonSafe(configPath);
    
    if (config && config.wordPattern && typeof config.wordPattern === 'string') {
        try {
            config.wordPattern = new RegExp(config.wordPattern);
        } catch (error) {
            logger.errorFromException(error, 'Invalid wordPattern regex', 'Extension');
            delete config.wordPattern;
        }
    }
    
    return config;
}

export function activate(context: vscode.ExtensionContext) {
    logger.info('Extension activation started', 'Extension', { event: process.env.VSCODE_NLS_CONFIG || 'unknown' });

    const config = vscode.workspace.getConfiguration('justlang-lsp');
    let enableLsp = config.get<boolean>('enableLsp', true);
    let enableTaskProvider = config.get<boolean>('enableTaskProvider', true);

    const startLsp = async () => {
        if (client) {
            logger.info('LSP client already running. Stopping before restarting.', 'Extension');
            await stopLsp();
        }
        logger.info('Creating language client', 'Extension');
        client = await createLanguageClient(context);
        if (client) {
            logger.info('Language client created, starting...', 'Extension');
            try {
                logger.info('About to call client.start()', 'Extension');
                await client.start();
                logger.info('Language client started successfully', 'Extension', { state: client.state });
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                const errorStack = err instanceof Error ? err.stack : 'No stack trace available';
                logger.error('Language client failed to start', 'Extension', {
                    error: errorMessage,
                    stack: errorStack,
                    clientState: client?.state
                });
                console.error('[justlang-lsp] DETAILED START ERROR:', {
                    message: errorMessage,
                    stack: errorStack,
                    error: err
                });
                vscode.window.showErrorMessage(`justlang-lsp language client failed to start: ${errorMessage}`);
            }
        } else {
            logger.error('Language client creation failed', 'Extension');
            vscode.window.showErrorMessage('justlang-lsp language client creation failed.');
        }
    };

    const stopLsp = async () => {
        if (client) {
            logger.info('Stopping language client', 'Extension');
            try {
                await client.stop();
            } catch (e) {
                logger.errorFromException(e, 'Error stopping language client', 'Extension');
            }
            client = null;
        }
    };

    vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration('justlang-lsp.enableLsp')) {
            const newEnableLsp = vscode.workspace.getConfiguration('justlang-lsp').get<boolean>('enableLsp', true);
            if (newEnableLsp && !client) {
                await startLsp();
            } else if (!newEnableLsp && client) {
                await stopLsp();
            }
        }
    });

    // Register commands once during activation
    registerCommands(context, null);

    if (enableLsp) {
        startLsp();
    } else {
        logger.info('LSP subsystem disabled by configuration', 'Extension');
    }

    if (enableTaskProvider) {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceRoot) {
            const taskProvider = new JustTaskProvider(workspaceRoot);
            context.subscriptions.push(vscode.tasks.registerTaskProvider(JustTaskProvider.JustType, taskProvider));
            logger.info('JustTaskProvider registered', 'Extension', { workspaceRoot });
        } else {
            logger.warning('No workspaceRoot found, JustTaskProvider not registered', 'Extension');
        }
    } else {
        logger.info('TaskProvider subsystem disabled by configuration', 'Extension');
    }

    const languageConfig = loadLanguageConfiguration(context);
    if (languageConfig) {
        vscode.languages.setLanguageConfiguration('just', languageConfig);
        logger.info('Language configuration set', 'Extension');
    } else {
        logger.warning('Could not load language configuration', 'Extension');
    }

    logger.info('Extension activation completed', 'Extension');
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
