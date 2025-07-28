import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { RecipeRunner } from './recipe-runner';
import { JustLspInstaller } from './just-lsp-installer';

let commandsRegistered = false;
let recipeRunner: RecipeRunner | null = null;

function getRecipeRunner(): RecipeRunner | null {
    if (!recipeRunner) {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceRoot) {
            recipeRunner = new RecipeRunner(workspaceRoot);
        }
    }
    return recipeRunner;
}

export function registerCommands(context: vscode.ExtensionContext, client: LanguageClient | null): void {
    if (commandsRegistered) {
        console.log('[justlang-lsp] Commands already registered, skipping...');
        return;
    }

    // Register the enhanced run recipe command with JSON parsing  
    // Note: Use different name to avoid conflict with LSP server's executeCommandProvider
    const runRecipeCommand = vscode.commands.registerCommand('justlang-lsp.run_recipe', async (recipeName?: string, args?: string[]) => {
        const runner = getRecipeRunner();
        if (!runner) {
            vscode.window.showErrorMessage('No workspace found for recipe execution');
            return;
        }

        try {
            if (recipeName) {
                // Run specific recipe by name
                await runner.runRecipeByName(recipeName);
            } else {
                // Show interactive recipe selector with rich metadata
                await runner.runRecipeCommand();
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[justlang-lsp] Recipe execution failed:', error);
            vscode.window.showErrorMessage(`Failed to run recipe: ${errorMessage}`);
        }
    });

    // Register enhanced show recipes command with grouping
    const showRecipesCommand = vscode.commands.registerCommand('just-lsp.show_recipes', async () => {
        const runner = getRecipeRunner();
        if (!runner) {
            vscode.window.showErrorMessage('No workspace found for recipe browsing');
            return;
        }

        try {
            await runner.showRecipeBrowser();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[justlang-lsp] Recipe browser failed:', error);
            vscode.window.showErrorMessage(`Failed to show recipes: ${errorMessage}`);
        }
    });

    // Register install just-lsp command
    const installJustLspCommand = vscode.commands.registerCommand('just-lsp.install', async () => {
        const installer = new JustLspInstaller();
        
        // First check if already installed
        const existingPath = await installer.detectJustLsp();
        if (existingPath) {
            const choice = await vscode.window.showInformationMessage(
                `just-lsp is already installed at: ${existingPath}`,
                'Reinstall',
                'OK'
            );
            if (choice !== 'Reinstall') {
                return;
            }
        }
        
        // Attempt installation
        const result = await installer.installJustLsp();
        if (result.success) {
            const choice = await vscode.window.showInformationMessage(
                `just-lsp installed successfully at: ${result.path}`,
                'Reload Window'
            );
            if (choice === 'Reload Window') {
                vscode.commands.executeCommand('workbench.action.reloadWindow');
            }
        } else {
            vscode.window.showErrorMessage(`Installation failed: ${result.error}`);
        }
    });

    context.subscriptions.push(runRecipeCommand, showRecipesCommand, installJustLspCommand);
    commandsRegistered = true;
    console.log('[justlang-lsp] Commands registered successfully');
}