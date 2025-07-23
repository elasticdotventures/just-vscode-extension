import * as assert from 'assert';
import { RecipeManager } from '../recipe-manager';
import { RecipeParameterKind } from '../recipe-types';

describe('Recipe Manager', () => {
    let recipeManager: RecipeManager;
    const mockWorkspaceRoot = '/tmp/test-workspace';

    beforeEach(() => {
        recipeManager = new RecipeManager(mockWorkspaceRoot);
    });

    describe('Recipe Parsing', () => {
        it('should parse recipe response correctly', () => {
            const mockJsonOutput = JSON.stringify({
                recipes: {
                    'build': {
                        name: 'build',
                        doc: 'Build the project',
                        parameters: [
                            {
                                name: 'target',
                                kind: 'singular',
                                default: 'debug'
                            },
                            {
                                name: 'flags',
                                kind: 'plus',
                                default: null
                            }
                        ],
                        attributes: [
                            { group: 'build' }
                        ],
                        private: false
                    },
                    'test-internal': {
                        name: 'test-internal',
                        doc: 'Run internal tests',
                        parameters: [],
                        attributes: ['private'],
                        private: true
                    }
                }
            });

            // Use private method through type assertion for testing
            const recipes = (recipeManager as any).parseRecipes(mockJsonOutput);

            assert.strictEqual(recipes.length, 2);
            
            const buildRecipe = recipes.find((r: any) => r.name === 'build');
            assert.ok(buildRecipe, 'Should find build recipe');
            assert.strictEqual(buildRecipe.doc, 'Build the project');
            assert.strictEqual(buildRecipe.parameters.length, 2);
            assert.strictEqual(buildRecipe.groups.length, 1);
            assert.strictEqual(buildRecipe.groups[0], 'build');
            assert.strictEqual(buildRecipe.private, false);

            const testRecipe = recipes.find((r: any) => r.name === 'test-internal');
            assert.ok(testRecipe, 'Should find test-internal recipe');
            assert.strictEqual(testRecipe.private, true);
            assert.strictEqual(testRecipe.groups.length, 0);
        });

        it('should handle empty recipe dump', () => {
            const mockJsonOutput = JSON.stringify({ recipes: {} });
            const recipes = (recipeManager as any).parseRecipes(mockJsonOutput);
            assert.strictEqual(recipes.length, 0);
        });

        it('should handle invalid JSON gracefully', () => {
            const recipes = (recipeManager as any).parseRecipes('invalid json');
            assert.strictEqual(recipes.length, 0);
        });
    });

    describe('Group Extraction', () => {
        it('should extract groups from attributes', () => {
            const attributes = [
                { group: 'build' },
                { group: 'test' },
                'private',
                { confirm: 'Continue?' }
            ];

            const groups = (recipeManager as any).extractGroups(attributes);
            assert.strictEqual(groups.length, 2);
            assert.ok(groups.includes('build'));
            assert.ok(groups.includes('test'));
        });

        it('should handle empty attributes', () => {
            const groups = (recipeManager as any).extractGroups([]);
            assert.strictEqual(groups.length, 0);
        });
    });

    describe('Private Recipe Detection', () => {
        it('should detect private attribute as string', () => {
            const attributes = ['private', 'linux'];
            const isPrivate = (recipeManager as any).isPrivateFromAttributes(attributes);
            assert.strictEqual(isPrivate, true);
        });

        it('should detect private attribute as object', () => {
            const attributes = [{ private: '' }, { group: 'test' }];
            const isPrivate = (recipeManager as any).isPrivateFromAttributes(attributes);
            assert.strictEqual(isPrivate, true);
        });

        it('should return false for non-private attributes', () => {
            const attributes = [{ group: 'build' }, 'linux'];
            const isPrivate = (recipeManager as any).isPrivateFromAttributes(attributes);
            assert.strictEqual(isPrivate, false);
        });
    });

    describe('Cache Management', () => {
        it('should clear cache correctly', () => {
            recipeManager.clearCache();
            // Cache should be empty after clearing
            const cache = (recipeManager as any).cachedRecipes;
            assert.strictEqual(cache, null);
        });
    });

    describe('Confirmation Detection', () => {
        it('should detect confirmation attribute', () => {
            const recipe = {
                name: 'deploy',
                doc: 'Deploy to production',
                parameters: [],
                groups: [],
                private: false,
                attributes: [{ confirm: 'Deploy to prod?' }]
            };

            const confirmMessage = recipeManager.hasConfirmation(recipe);
            assert.strictEqual(confirmMessage, 'Deploy to prod?');
        });

        it('should return null for no confirmation', () => {
            const recipe = {
                name: 'build',
                doc: 'Build project',
                parameters: [],
                groups: [],
                private: false,
                attributes: [{ group: 'build' }]
            };

            const confirmMessage = recipeManager.hasConfirmation(recipe);
            assert.strictEqual(confirmMessage, null);
        });
    });

    describe('Parameter Formatting', () => {
        it('should format parameters correctly', () => {
            const parameters = [
                { name: 'target', kind: RecipeParameterKind.SINGULAR, default: 'debug' },
                { name: 'flags', kind: RecipeParameterKind.PLUS, default: null },
                { name: 'verbose', kind: RecipeParameterKind.SINGULAR, default: null }
            ];

            const formatted = recipeManager.formatParametersToString(parameters);
            
            // Should sort plus parameters last and include defaults
            assert.ok(formatted.includes('target=debug'));
            assert.ok(formatted.includes('+flags'));
            assert.ok(formatted.includes('verbose'));
        });

        it('should handle empty parameters', () => {
            const formatted = recipeManager.formatParametersToString([]);
            assert.strictEqual(formatted, '');
        });
    });
});