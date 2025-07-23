import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import { RecipeManager } from './recipe-manager';
import { RecipeParameterHandler, ParameterInput } from './recipe-parameters';
import { RecipeParsed, RecipeQuickPickItem } from './recipe-types';
import { getLogger } from './logger';
import { getTerminalManager } from './terminal-manager';

export class RecipeRunner {
    private recipeManager: RecipeManager;
    private parameterHandler: RecipeParameterHandler;
    private logger = getLogger();
    private terminalManager = getTerminalManager();

    constructor(private workspaceRoot: string) {
        this.recipeManager = new RecipeManager(workspaceRoot);
        this.parameterHandler = new RecipeParameterHandler();
        this.logger.info('Recipe runner initialized', 'RecipeRunner', { workspaceRoot });
    }

    /**
     * Main entry point for running recipes with full parameter support
     */
    async runRecipeCommand(): Promise<void> {
        try {
            // Get available recipes
            const quickPickItems = await this.recipeManager.getRecipeQuickPickItems(false, true);
            
            if (quickPickItems.length === 0) {
                vscode.window.showInformationMessage(
                    'No recipes found. Make sure there is a valid Justfile in your workspace.'
                );
                return;
            }

            // Let user select recipe
            const selectedItem = await this.selectRecipe(quickPickItems);
            if (!selectedItem) {
                return; // User cancelled
            }

            // Execute the selected recipe
            await this.executeRecipe(selectedItem.recipe);

        } catch (error) {
            this.logger.errorFromException(error, 'Recipe execution failed');
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to run recipe: ${errorMessage}`);
        }
    }

    /**
     * Run a specific recipe by name
     */
    async runRecipeByName(recipeName: string): Promise<void> {
        try {
            const recipe = await this.recipeManager.findRecipe(recipeName);
            if (!recipe) {
                vscode.window.showErrorMessage(`Recipe '${recipeName}' not found.`);
                return;
            }

            if (recipe.private) {
                const proceed = await vscode.window.showWarningMessage(
                    `Recipe '${recipeName}' is marked as private. Continue anyway?`,
                    'Yes', 'No'
                );
                if (proceed !== 'Yes') {
                    return;
                }
            }

            await this.executeRecipe(recipe);

        } catch (error) {
            this.logger.errorFromException(error, `Failed to run recipe '${recipeName}'`);
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to run recipe '${recipeName}': ${errorMessage}`);
        }
    }

    /**
     * Show recipe browser with grouping support
     */
    async showRecipeBrowser(): Promise<void> {
        try {
            const recipesByGroup = await this.recipeManager.getRecipesByGroup(false, true);
            const groups = Object.keys(recipesByGroup).sort();
            
            if (groups.length === 0) {
                vscode.window.showInformationMessage('No recipes found.');
                return;
            }

            // Create grouped quick pick items
            const items: (RecipeQuickPickItem & { kind?: vscode.QuickPickItemKind })[] = [];
            
            for (const group of groups) {
                const recipes = recipesByGroup[group];
                if (recipes.length === 0) {
                    continue;
                }

                // Add group separator (except for ungrouped)
                if (group !== '') {
                    items.push({
                        label: `📁 ${group}`,
                        kind: vscode.QuickPickItemKind.Separator,
                        recipe: {} as RecipeParsed
                    });
                }

                // Add recipes in this group
                for (const recipe of recipes) {
                    const icon = recipe.private ? '🔒' : '🍳';
                    items.push({
                        label: `${icon} ${recipe.name}`,
                        description: recipe.doc || 'No description',
                        detail: this.getRecipeDetailString(recipe),
                        recipe
                    });
                }
            }

            const selected = await vscode.window.showQuickPick(items.filter(item => item.kind !== vscode.QuickPickItemKind.Separator), {
                placeHolder: 'Select a recipe to run',
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (selected) {
                await this.executeRecipe(selected.recipe);
            }

        } catch (error) {
            this.logger.errorFromException(error, 'Recipe browser failed');
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to show recipes: ${errorMessage}`);
        }
    }

    /**
     * Execute a recipe with full parameter handling
     */
    private async executeRecipe(recipe: RecipeParsed): Promise<void> {
        try {
            // Check for confirmation requirement
            const confirmMessage = this.recipeManager.hasConfirmation(recipe);
            if (confirmMessage) {
                const proceed = await vscode.window.showWarningMessage(
                    confirmMessage,
                    { modal: true },
                    'Continue', 'Cancel'
                );
                if (proceed !== 'Continue') {
                    return;
                }
            }

            // Get parameters from user
            const parameterInputs = await this.parameterHandler.promptForParameters(recipe);
            if (parameterInputs === undefined) {
                return; // User cancelled
            }

            // Validate parameters
            const validationErrors = this.parameterHandler.validateParameters(recipe, parameterInputs);
            if (validationErrors.length > 0) {
                vscode.window.showErrorMessage(
                    `Parameter validation failed:\n${validationErrors.join('\n')}`
                );
                return;
            }

            // Show summary and confirm execution
            const proceed = await this.parameterHandler.showParameterSummary(recipe.name, parameterInputs);
            if (!proceed) {
                return;
            }

            // Build command arguments
            const args = this.parameterHandler.buildCommandArguments(recipe.name, parameterInputs);
            
            // Execute recipe
            await this.executeJustCommand(args, recipe);

        } catch (error) {
            this.logger.errorFromException(error, `Failed to execute recipe '${recipe.name}'`);
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to execute recipe '${recipe.name}': ${errorMessage}`);
        }
    }

    /**
     * Select recipe from quick pick
     */
    private async selectRecipe(quickPickItems: RecipeQuickPickItem[]): Promise<RecipeQuickPickItem | undefined> {
        return await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: 'Select a recipe to run',
            matchOnDescription: true,
            matchOnDetail: true
        });
    }

    /**
     * Execute just command with given arguments
     */
    private async executeJustCommand(args: string[], recipe: RecipeParsed): Promise<void> {
        const config = vscode.workspace.getConfiguration('justlang-lsp');
        const justPath = config.get<string>('justPath', 'just');
        const runInTerminal = config.get<boolean>('runInTerminal', false);

        this.logger.info(`Executing recipe: ${recipe.name}`, 'RecipeRunner', {
            command: justPath,
            args: args,
            runInTerminal
        });

        if (runInTerminal) {
            await this.runInTerminal(justPath, args, recipe);
        } else {
            this.runInBackground(justPath, args, recipe);
        }
    }

    /**
     * Run recipe in VSCode terminal using advanced terminal manager
     */
    private async runInTerminal(justPath: string, args: string[], recipe: RecipeParsed): Promise<void> {
        const terminalName = `Just: ${recipe.name}`;
        
        try {
            await this.terminalManager.execute({
                command: justPath,
                args: args,
                cwd: this.workspaceRoot,
                terminalName: terminalName,
                reuseTerminal: vscode.workspace.getConfiguration('justlang-lsp').get<boolean>('useSingleTerminal', false),
                showTerminal: true
            });

            this.logger.info(`Recipe executed in terminal: ${recipe.name}`, 'RecipeRunner');
        } catch (error) {
            this.logger.errorFromException(error, `Failed to execute recipe in terminal: ${recipe.name}`);
            throw error;
        }
    }

    /**
     * Run recipe in background and show output in output channel
     */
    private runInBackground(justPath: string, args: string[], recipe: RecipeParsed): void {
        const outputChannel = vscode.window.createOutputChannel(`Just Recipe: ${recipe.name}`);
        outputChannel.show();
        
        const timestamp = new Date().toISOString();
        outputChannel.appendLine(`[${timestamp}] Executing: ${justPath} ${args.join(' ')}`);
        outputChannel.appendLine(`Working directory: ${this.workspaceRoot}`);
        outputChannel.appendLine('─'.repeat(50));

        this.logger.info(`Running recipe in background: ${recipe.name}`, 'RecipeRunner', {
            command: justPath,
            args: args,
            cwd: this.workspaceRoot
        });

        const childProcess: ChildProcess = spawn(justPath, args, { 
            cwd: this.workspaceRoot,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        childProcess.stdout?.on('data', (data: Buffer) => {
            outputChannel.append(data.toString());
        });

        childProcess.stderr?.on('data', (data: Buffer) => {
            outputChannel.append(data.toString());
        });

        childProcess.on('close', (code) => {
            const timestamp = new Date().toISOString();
            outputChannel.appendLine('─'.repeat(50));
            
            if (code === 0) {
                outputChannel.appendLine(`[${timestamp}] Recipe '${recipe.name}' completed successfully.`);
                this.logger.info(`Recipe completed successfully: ${recipe.name}`, 'RecipeRunner', { exitCode: code });
            } else {
                outputChannel.appendLine(`[${timestamp}] Recipe '${recipe.name}' failed with exit code ${code}.`);
                this.logger.error(`Recipe failed: ${recipe.name}`, 'RecipeRunner', { exitCode: code });
                vscode.window.showErrorMessage(`Recipe '${recipe.name}' failed with exit code ${code}. Check output for details.`);
            }
        });

        childProcess.on('error', (error) => {
            const timestamp = new Date().toISOString();
            outputChannel.appendLine(`[${timestamp}] Error: ${error.message}`);
            this.logger.errorFromException(error, `Recipe execution error: ${recipe.name}`);
            vscode.window.showErrorMessage(`Failed to execute recipe: ${error.message}`);
        });
    }

    /**
     * Get recipe detail string for display
     */
    private getRecipeDetailString(recipe: RecipeParsed): string {
        const parts: string[] = [];
        
        if (recipe.parameters.length > 0) {
            parts.push(`Parameters: ${this.parameterHandler.getParameterDisplayString(recipe)}`);
        }
        
        if (recipe.groups.length > 0) {
            parts.push(`Groups: ${recipe.groups.join(', ')}`);
        }

        return parts.join(' • ');
    }

    /**
     * Clear recipe cache (useful for development)
     */
    clearCache(): void {
        this.recipeManager.clearCache();
    }

    /**
     * Get recipe manager instance (for testing or advanced usage)
     */
    getRecipeManager(): RecipeManager {
        return this.recipeManager;
    }
}