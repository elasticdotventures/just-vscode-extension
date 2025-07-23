import { exec } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import * as path from 'path';
import { 
    RecipeParsed, 
    RecipeResponse, 
    JustDumpResponse, 
    RecipeQuickPickItem,
    RecipeParameterKind,
    RecipeAttribute
} from './recipe-types';
import { getLogger } from './logger';

const asyncExec = promisify(exec);

export class RecipeManager {
    private cachedRecipes: RecipeParsed[] | null = null;
    private cacheTimestamp: number = 0;
    private readonly cacheTimeout = 5000; // 5 seconds
    private logger = getLogger();

    constructor(private workspaceRoot: string) {
        this.logger.info('Recipe manager initialized', 'RecipeManager', { workspaceRoot });
    }

    /**
     * Get the path to the just executable
     */
    private getJustPath(): string {
        const config = vscode.workspace.getConfiguration('justlang-lsp');
        return config.get<string>('justPath', 'just');
    }

    /**
     * Get all recipes using JSON dump format
     */
    async getRecipes(forceRefresh = false): Promise<RecipeParsed[]> {
        const now = Date.now();
        
        // Return cached results if still valid
        if (!forceRefresh && this.cachedRecipes && (now - this.cacheTimestamp) < this.cacheTimeout) {
            return this.cachedRecipes;
        }

        try {
            const cmd = `${this.getJustPath()} --dump --dump-format=json`;
            this.logger.info('Fetching recipes using JSON dump', 'RecipeManager', { 
                command: cmd,
                workspaceRoot: this.workspaceRoot 
            });
            
            const { stdout, stderr } = await asyncExec(cmd, { 
                cwd: this.workspaceRoot,
                timeout: 10000 // 10 second timeout
            });

            if (stderr) {
                this.logger.warning('Just dump produced stderr output', 'RecipeManager', { stderr });
            }

            const recipes = this.parseRecipes(stdout);
            
            // Update cache
            this.cachedRecipes = recipes;
            this.cacheTimestamp = now;
            
            this.logger.info(`Found ${recipes.length} recipes`, 'RecipeManager', { count: recipes.length });
            return recipes;

        } catch (error) {
            this.logger.errorFromException(error, 'Failed to get recipes');
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // Show user-friendly error message
            vscode.window.showErrorMessage(
                `Failed to fetch recipes: ${errorMessage}. Make sure 'just' is installed and there's a valid Justfile in the workspace.`
            );
            
            return [];
        }
    }

    /**
     * Parse the JSON output from just --dump
     */
    private parseRecipes(output: string): RecipeParsed[] {
        try {
            const dumpResponse: JustDumpResponse = JSON.parse(output);
            
            if (!dumpResponse.recipes || typeof dumpResponse.recipes !== 'object') {
                console.warn('[justlang-lsp] Invalid recipe dump format');
                return [];
            }

            return Object.values(dumpResponse.recipes)
                .map((recipe: RecipeResponse) => this.parseRecipe(recipe))
                .filter((recipe): recipe is RecipeParsed => recipe !== null);
                
        } catch (error) {
            this.logger.errorFromException(error, 'Failed to parse recipe JSON');
            return [];
        }
    }

    /**
     * Parse a single recipe from the JSON response
     */
    private parseRecipe(recipeResponse: RecipeResponse): RecipeParsed | null {
        try {
            const groups = this.extractGroups(recipeResponse.attributes);
            
            return {
                name: recipeResponse.name,
                doc: recipeResponse.doc || '',
                parameters: recipeResponse.parameters.map(param => ({
                    name: param.name,
                    kind: param.kind,
                    default: param.default
                })),
                groups,
                private: recipeResponse.private || this.isPrivateFromAttributes(recipeResponse.attributes),
                attributes: recipeResponse.attributes
            };
        } catch (error) {
            console.error(`[justlang-lsp] Failed to parse recipe ${recipeResponse.name}:`, error);
            return null;
        }
    }

    /**
     * Extract group names from recipe attributes
     */
    private extractGroups(attributes: (RecipeAttribute | string)[]): string[] {
        return attributes
            .filter((attr): attr is RecipeAttribute => 
                typeof attr === 'object' && attr !== null && 'group' in attr
            )
            .map((attr: RecipeAttribute) => attr.group)
            .filter((group): group is string => typeof group === 'string');
    }

    /**
     * Check if recipe is private based on attributes
     */
    private isPrivateFromAttributes(attributes: (RecipeAttribute | string)[]): boolean {
        return attributes.some(attr => 
            (typeof attr === 'string' && attr === 'private') ||
            (typeof attr === 'object' && attr !== null && 'private' in attr)
        );
    }

    /**
     * Get public recipes only (filtered for user interface)
     */
    async getPublicRecipes(forceRefresh = false): Promise<RecipeParsed[]> {
        const allRecipes = await this.getRecipes(forceRefresh);
        return allRecipes.filter(recipe => !recipe.private);
    }

    /**
     * Get recipes grouped by their group attribute
     */
    async getRecipesByGroup(includePrivate = false, forceRefresh = false): Promise<Record<string, RecipeParsed[]>> {
        const recipes = includePrivate 
            ? await this.getRecipes(forceRefresh)
            : await this.getPublicRecipes(forceRefresh);

        const grouped: Record<string, RecipeParsed[]> = {};
        
        // Add ungrouped category
        grouped[''] = [];

        for (const recipe of recipes) {
            if (recipe.groups.length === 0) {
                grouped[''].push(recipe);
            } else {
                for (const group of recipe.groups) {
                    if (!grouped[group]) {
                        grouped[group] = [];
                    }
                    grouped[group].push(recipe);
                }
            }
        }

        return grouped;
    }

    /**
     * Find a specific recipe by name
     */
    async findRecipe(name: string, forceRefresh = false): Promise<RecipeParsed | null> {
        const recipes = await this.getRecipes(forceRefresh);
        return recipes.find(recipe => recipe.name === name) || null;
    }

    /**
     * Convert recipes to VSCode QuickPick items
     */
    async getRecipeQuickPickItems(includePrivate = false, forceRefresh = false): Promise<RecipeQuickPickItem[]> {
        const recipes = includePrivate 
            ? await this.getRecipes(forceRefresh)
            : await this.getPublicRecipes(forceRefresh);

        return recipes
            .map((recipe): RecipeQuickPickItem => ({
                label: recipe.name,
                description: recipe.doc || 'No description',
                detail: this.getRecipeDetailString(recipe),
                recipe
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }

    /**
     * Generate detail string for recipe quick pick
     */
    private getRecipeDetailString(recipe: RecipeParsed): string {
        const details: string[] = [];
        
        if (recipe.groups.length > 0) {
            details.push(`Groups: ${recipe.groups.sort().join(', ')}`);
        }

        if (recipe.parameters.length > 0) {
            const paramStr = recipe.parameters
                .map(p => {
                    const prefix = p.kind === RecipeParameterKind.PLUS ? '+' : '';
                    const defaultValue = p.default ? `=${p.default}` : '';
                    return `${prefix}${p.name}${defaultValue}`;
                })
                .join(' ');
            details.push(`Parameters: ${paramStr}`);
        }

        if (recipe.private) {
            details.push('Private');
        }

        return details.join(' | ');
    }

    /**
     * Check if recipe has confirmation attribute
     */
    hasConfirmation(recipe: RecipeParsed): string | null {
        for (const attr of recipe.attributes) {
            if (typeof attr === 'object' && attr !== null && 'confirm' in attr) {
                return attr.confirm || 'Continue?';
            }
        }
        return null;
    }

    /**
     * Clear the recipe cache
     */
    clearCache(): void {
        this.cachedRecipes = null;
        this.cacheTimestamp = 0;
    }

    /**
     * Format parameters to string for display
     */
    formatParametersToString(parameters: RecipeParsed['parameters']): string {
        return parameters
            .sort((a, b) => 
                a.kind === RecipeParameterKind.PLUS ? 1 : a.name.localeCompare(b.name)
            )
            .map((p) => {
                let formatted = `${p.kind === RecipeParameterKind.PLUS ? '+' : ''}${p.name}`;
                if (p.default !== null) {
                    formatted += `=${p.default}`;
                }
                return formatted;
            })
            .join(' ');
    }
}