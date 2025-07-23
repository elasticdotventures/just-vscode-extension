import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';

let commandsRegistered = false;

export function registerCommands(context: vscode.ExtensionContext, client: LanguageClient | null): void {
    if (commandsRegistered) {
        console.log('[justlang-lsp] Commands already registered, skipping...');
        return;
    }

    // Register the run recipe command
    const runRecipeCommand = vscode.commands.registerCommand('just-lsp.run_recipe', async (recipeName?: string, args?: string[]) => {
        if (!client) {
            vscode.window.showErrorMessage('Just LSP client is not available');
            return;
        }

        try {
            // If no recipe name provided, prompt user to select one
            if (!recipeName) {
                const activeEditor = vscode.window.activeTextEditor;
                if (!activeEditor || activeEditor.document.languageId !== 'just') {
                    vscode.window.showErrorMessage('Please open a Justfile to run recipes');
                    return;
                }

                // Get available recipes from the server
                const recipes = await client.sendRequest('textDocument/documentSymbol', {
                    textDocument: { uri: activeEditor.document.uri.toString() }
                });

                if (!recipes || !Array.isArray(recipes) || recipes.length === 0) {
                    vscode.window.showInformationMessage('No recipes found in the current Justfile');
                    return;
                }

                // Show quick pick for recipe selection
                const recipeItems = recipes
                    .filter((symbol: any) => symbol.kind === vscode.SymbolKind.Function)
                    .map((symbol: any) => ({
                        label: symbol.name,
                        description: symbol.detail || 'Recipe'
                    }));

                const selectedRecipe = await vscode.window.showQuickPick(recipeItems, {
                    placeHolder: 'Select a recipe to run'
                });

                if (!selectedRecipe) {
                    return;
                }

                recipeName = selectedRecipe.label;
            }

            // Execute the recipe via LSP server command
            const result = await client.sendRequest('workspace/executeCommand', {
                command: 'just-lsp.run_recipe',
                arguments: [recipeName, ...(args || [])]
            });

            // Show result in output channel
            const outputChannel = vscode.window.createOutputChannel(`Just Recipe: ${recipeName}`);
            outputChannel.show();
            
            if (result && typeof result === 'object' && 'output' in result) {
                outputChannel.appendLine(result.output as string);
            } else if (typeof result === 'string') {
                outputChannel.appendLine(result);
            } else {
                outputChannel.appendLine(`Recipe "${recipeName}" executed successfully`);
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to run recipe "${recipeName}": ${errorMessage}`);
            console.error('[justlang-lsp] Recipe execution failed:', error);
        }
    });

    // Register show recipes command for command palette
    const showRecipesCommand = vscode.commands.registerCommand('just-lsp.show_recipes', async () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || activeEditor.document.languageId !== 'just') {
            vscode.window.showErrorMessage('Please open a Justfile to view recipes');
            return;
        }

        if (!client) {
            vscode.window.showErrorMessage('Just LSP client is not available');
            return;
        }

        try {
            const symbols = await client.sendRequest('textDocument/documentSymbol', {
                textDocument: { uri: activeEditor.document.uri.toString() }
            });

            if (!symbols || !Array.isArray(symbols)) {
                vscode.window.showInformationMessage('No symbols found in the current Justfile');
                return;
            }

            const recipes = symbols.filter((symbol: any) => symbol.kind === vscode.SymbolKind.Function);
            const variables = symbols.filter((symbol: any) => symbol.kind === vscode.SymbolKind.Variable);
            
            const items = [
                ...recipes.map((recipe: any) => ({
                    label: `🍳 ${recipe.name}`,
                    description: 'Recipe',
                    detail: recipe.detail || 'No description available'
                })),
                ...variables.map((variable: any) => ({
                    label: `📦 ${variable.name}`,
                    description: 'Variable',
                    detail: variable.detail || 'No description available'
                }))
            ];

            if (items.length === 0) {
                vscode.window.showInformationMessage('No recipes or variables found in the current Justfile');
                return;
            }

            const selectedItem = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a recipe to run or view details'
            });

            if (selectedItem && selectedItem.description === 'Recipe') {
                const recipeName = selectedItem.label.replace('🍳 ', '');
                await vscode.commands.executeCommand('just-lsp.run_recipe', recipeName);
            }

        } catch (error) {
            console.error('[justlang-lsp] Failed to get document symbols:', error);
            vscode.window.showErrorMessage('Failed to retrieve recipes from the current Justfile');
        }
    });

    context.subscriptions.push(runRecipeCommand, showRecipesCommand);
    commandsRegistered = true;
    console.log('[justlang-lsp] Commands registered successfully');
}