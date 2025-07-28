import * as assert from 'assert';
import { RecipeParameterHandler } from '../recipe-parameters';
import { RecipeParameterKind } from '../recipe-types';

describe('Recipe Parameter Handler', () => {
    let parameterHandler: RecipeParameterHandler;

    beforeEach(() => {
        parameterHandler = new RecipeParameterHandler();
    });

    describe('Command Arguments Building', () => {
        it('should build command arguments correctly', () => {
            const recipeName = 'build';
            const parameterInputs = [
                {
                    name: 'target',
                    value: 'release',
                    kind: RecipeParameterKind.SINGULAR
                },
                {
                    name: 'flags',
                    value: ['--verbose', '--color'],
                    kind: RecipeParameterKind.PLUS
                }
            ];

            const args = parameterHandler.buildCommandArguments(recipeName, parameterInputs);
            
            assert.strictEqual(args[0], 'build');
            assert.strictEqual(args[1], 'release');
            assert.strictEqual(args[2], '--verbose');
            assert.strictEqual(args[3], '--color');
        });

        it('should handle empty parameter values', () => {
            const recipeName = 'test';
            const parameterInputs = [
                {
                    name: 'target',
                    value: '',
                    kind: RecipeParameterKind.SINGULAR
                },
                {
                    name: 'flags',
                    value: [],
                    kind: RecipeParameterKind.PLUS
                }
            ];

            const args = parameterHandler.buildCommandArguments(recipeName, parameterInputs);
            
            // Should only include recipe name for empty parameters
            assert.strictEqual(args.length, 1);
            assert.strictEqual(args[0], 'test');
        });
    });

    describe('Parameter Validation', () => {
        it('should validate required parameters', () => {
            const recipe = {
                name: 'deploy',
                doc: 'Deploy application',
                parameters: [
                    { name: 'environment', kind: RecipeParameterKind.SINGULAR, default: null },
                    { name: 'flags', kind: RecipeParameterKind.PLUS, default: '' }
                ],
                groups: [],
                private: false,
                attributes: []
            };

            const parameterInputs = [
                {
                    name: 'flags',
                    value: ['--force'],
                    kind: RecipeParameterKind.PLUS
                }
                // Missing required 'environment' parameter
            ];

            const errors = parameterHandler.validateParameters(recipe, parameterInputs);
            
            assert.strictEqual(errors.length, 1);
            assert.ok(errors[0].includes('environment'));
            assert.ok(errors[0].includes('missing'));
        });

        it('should detect unknown parameters', () => {
            const recipe = {
                name: 'build',
                doc: 'Build project',
                parameters: [
                    { name: 'target', kind: RecipeParameterKind.SINGULAR, default: 'debug' }
                ],
                groups: [],
                private: false,
                attributes: []
            };

            const parameterInputs = [
                {
                    name: 'target',
                    value: 'release',
                    kind: RecipeParameterKind.SINGULAR
                },
                {
                    name: 'unknown_param',
                    value: 'value',
                    kind: RecipeParameterKind.SINGULAR
                }
            ];

            const errors = parameterHandler.validateParameters(recipe, parameterInputs);
            
            assert.strictEqual(errors.length, 1);
            assert.ok(errors[0].includes('unknown_param'));
            assert.ok(errors[0].includes('Unknown parameter'));
        });

        it('should pass validation for valid parameters', () => {
            const recipe = {
                name: 'test',
                doc: 'Run tests',
                parameters: [
                    { name: 'filter', kind: RecipeParameterKind.SINGULAR, default: '' },
                    { name: 'args', kind: RecipeParameterKind.PLUS, default: null }
                ],
                groups: [],
                private: false,
                attributes: []
            };

            const parameterInputs = [
                {
                    name: 'filter',
                    value: 'unit',
                    kind: RecipeParameterKind.SINGULAR
                },
                {
                    name: 'args',
                    value: ['--nocapture'],
                    kind: RecipeParameterKind.PLUS
                }
            ];

            const errors = parameterHandler.validateParameters(recipe, parameterInputs);
            assert.strictEqual(errors.length, 0);
        });
    });

    describe('Command Line Parsing', () => {
        it('should parse command line string', () => {
            const commandLine = 'target=release verbose=true flags=--color';
            const params = parameterHandler.parseCommandLineString(commandLine);
            
            assert.strictEqual(params.target, 'release');
            assert.strictEqual(params.verbose, 'true');
            assert.strictEqual(params.flags, '--color');
        });

        it('should handle empty command line', () => {
            const params = parameterHandler.parseCommandLineString('');
            assert.strictEqual(Object.keys(params).length, 0);
        });

        it('should handle malformed parameters', () => {
            const commandLine = 'target release verbose';
            const params = parameterHandler.parseCommandLineString(commandLine);
            
            // Should only parse properly formatted key=value pairs
            assert.strictEqual(Object.keys(params).length, 0);
        });
    });

    describe('Parameter Display', () => {
        it('should format parameter display string', () => {
            const recipe = {
                name: 'build',
                doc: 'Build project',
                parameters: [
                    { name: 'target', kind: RecipeParameterKind.SINGULAR, default: 'debug' },
                    { name: 'flags', kind: RecipeParameterKind.PLUS, default: null },
                    { name: 'verbose', kind: RecipeParameterKind.SINGULAR, default: null }
                ],
                groups: [],
                private: false,
                attributes: []
            };

            const displayString = parameterHandler.getParameterDisplayString(recipe);
            
            assert.ok(displayString.includes('target=debug'));
            assert.ok(displayString.includes('+flags*'));
            assert.ok(displayString.includes('verbose*'));
        });

        it('should handle recipe with no parameters', () => {
            const recipe = {
                name: 'clean',
                doc: 'Clean build artifacts',
                parameters: [],
                groups: [],
                private: false,
                attributes: []
            };

            const displayString = parameterHandler.getParameterDisplayString(recipe);
            assert.strictEqual(displayString, 'No parameters');
        });
    });

    describe('Value Checking', () => {
        it('should detect meaningful values in arrays', () => {
            const input = {
                name: 'flags',
                value: ['--verbose', '', '  ', '--color'],
                kind: RecipeParameterKind.PLUS
            };

            const hasValue = (parameterHandler as any).hasValue(input);
            assert.strictEqual(hasValue, true);
        });

        it('should detect empty arrays', () => {
            const input = {
                name: 'flags',
                value: [],
                kind: RecipeParameterKind.PLUS
            };

            const hasValue = (parameterHandler as any).hasValue(input);
            assert.strictEqual(hasValue, false);
        });

        it('should detect meaningful string values', () => {
            const input = {
                name: 'target',
                value: 'release',
                kind: RecipeParameterKind.SINGULAR
            };

            const hasValue = (parameterHandler as any).hasValue(input);
            assert.strictEqual(hasValue, true);
        });

        it('should detect empty string values', () => {
            const input = {
                name: 'target',
                value: '   ',
                kind: RecipeParameterKind.SINGULAR
            };

            const hasValue = (parameterHandler as any).hasValue(input);
            assert.strictEqual(hasValue, false);
        });
    });
});