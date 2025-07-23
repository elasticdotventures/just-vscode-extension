import * as vscode from 'vscode';
import { RecipeParsed, RecipeParameterKind } from './recipe-types';

export interface ParameterInput {
    name: string;
    value: string | string[];
    kind: RecipeParameterKind;
}

export class RecipeParameterHandler {
    
    /**
     * Prompt user for recipe parameters
     */
    async promptForParameters(recipe: RecipeParsed): Promise<ParameterInput[] | undefined> {
        if (recipe.parameters.length === 0) {
            return [];
        }

        const inputs: ParameterInput[] = [];
        
        for (const param of recipe.parameters) {
            const input = await this.promptForSingleParameter(param, recipe.name);
            if (input === undefined) {
                // User cancelled
                return undefined;
            }
            inputs.push(input);
        }

        return inputs;
    }

    /**
     * Prompt for a single parameter
     */
    private async promptForSingleParameter(
        param: RecipeParsed['parameters'][0], 
        recipeName: string
    ): Promise<ParameterInput | undefined> {
        
        const isRequired = param.default === null;
        const isPlus = param.kind === RecipeParameterKind.PLUS;
        
        const promptMessage = this.buildParameterPrompt(param, recipeName);
        const placeholder = this.buildParameterPlaceholder(param);

        if (isPlus) {
            // Handle variadic parameters (can accept multiple values)
            const input = await vscode.window.showInputBox({
                prompt: promptMessage,
                placeHolder: placeholder,
                value: param.default || '',
                ignoreFocusOut: true
            });

            if (input === undefined) {
                return undefined;
            }

            // Parse space-separated values for plus parameters
            const values = input.trim() ? input.trim().split(/\s+/) : [];
            
            return {
                name: param.name,
                value: values,
                kind: param.kind
            };
        } else {
            // Handle singular parameters
            const input = await vscode.window.showInputBox({
                prompt: promptMessage,
                placeHolder: placeholder,
                value: param.default || '',
                ignoreFocusOut: true,
                validateInput: (value) => {
                    if (isRequired && !value.trim()) {
                        return `Parameter '${param.name}' is required`;
                    }
                    return null;
                }
            });

            if (input === undefined) {
                return undefined;
            }

            return {
                name: param.name,
                value: input,
                kind: param.kind
            };
        }
    }

    /**
     * Build user-friendly parameter prompt message
     */
    private buildParameterPrompt(param: RecipeParsed['parameters'][0], recipeName: string): string {
        const prefix = param.kind === RecipeParameterKind.PLUS ? '+' : '';
        const required = param.default === null ? ' (required)' : ' (optional)';
        
        return `Recipe '${recipeName}' - Enter value for parameter '${prefix}${param.name}'${required}:`;
    }

    /**
     * Build parameter placeholder text
     */
    private buildParameterPlaceholder(param: RecipeParsed['parameters'][0]): string {
        const parts: string[] = [];
        
        if (param.kind === RecipeParameterKind.PLUS) {
            parts.push('Space-separated values');
        }
        
        if (param.default !== null) {
            parts.push(`Default: ${param.default}`);
        } else {
            parts.push('Required parameter');
        }

        return parts.join(' • ');
    }

    /**
     * Convert parameter inputs to command line arguments
     */
    buildCommandArguments(recipeName: string, parameterInputs: ParameterInput[]): string[] {
        const args = [recipeName];
        
        for (const input of parameterInputs) {
            if (input.kind === RecipeParameterKind.PLUS) {
                // Variadic parameters: add each value separately
                const values = Array.isArray(input.value) ? input.value : [input.value];
                args.push(...values.filter(v => v.trim().length > 0));
            } else {
                // Singular parameters: add single value
                const value = Array.isArray(input.value) ? input.value[0] || '' : input.value;
                if (value.trim().length > 0) {
                    args.push(value);
                }
            }
        }

        return args;
    }

    /**
     * Show parameter summary before execution
     */
    async showParameterSummary(recipeName: string, parameterInputs: ParameterInput[]): Promise<boolean> {
        if (parameterInputs.length === 0) {
            return true;
        }

        const summary = parameterInputs
            .map(input => {
                const prefix = input.kind === RecipeParameterKind.PLUS ? '+' : '';
                const value = Array.isArray(input.value) 
                    ? input.value.join(' ') 
                    : input.value;
                return `  ${prefix}${input.name}: ${value || '(empty)'}`;
            })
            .join('\n');

        const message = `Execute recipe '${recipeName}' with parameters:\n\n${summary}`;
        
        const choice = await vscode.window.showInformationMessage(
            message,
            { modal: true },
            'Execute',
            'Cancel'
        );

        return choice === 'Execute';
    }

    /**
     * Parse command line string into parameters (for backward compatibility)
     */
    parseCommandLineString(commandLine: string): Record<string, string> {
        const params: Record<string, string> = {};
        
        // Simple parsing - split by spaces and look for key=value pairs
        const parts = commandLine.trim().split(/\s+/);
        
        for (const part of parts) {
            const equalIndex = part.indexOf('=');
            if (equalIndex > 0) {
                const key = part.substring(0, equalIndex);
                const value = part.substring(equalIndex + 1);
                params[key] = value;
            }
        }

        return params;
    }

    /**
     * Validate parameter inputs against recipe definition
     */
    validateParameters(recipe: RecipeParsed, parameterInputs: ParameterInput[]): string[] {
        const errors: string[] = [];
        const inputMap = new Map(parameterInputs.map(input => [input.name, input]));

        // Check required parameters
        for (const param of recipe.parameters) {
            const input = inputMap.get(param.name);
            
            if (param.default === null && (!input || !this.hasValue(input))) {
                errors.push(`Required parameter '${param.name}' is missing or empty`);
            }
        }

        // Check for unknown parameters
        for (const input of parameterInputs) {
            const paramDef = recipe.parameters.find(p => p.name === input.name);
            if (!paramDef) {
                errors.push(`Unknown parameter '${input.name}'`);
            }
        }

        return errors;
    }

    /**
     * Check if parameter input has a meaningful value
     */
    private hasValue(input: ParameterInput): boolean {
        if (Array.isArray(input.value)) {
            return input.value.some(v => v.trim().length > 0);
        }
        return input.value.trim().length > 0;
    }

    /**
     * Get parameter display string for UI
     */
    getParameterDisplayString(recipe: RecipeParsed): string {
        if (recipe.parameters.length === 0) {
            return 'No parameters';
        }

        return recipe.parameters
            .map(param => {
                const prefix = param.kind === RecipeParameterKind.PLUS ? '+' : '';
                const defaultValue = param.default !== null ? `=${param.default}` : '';
                const required = param.default === null ? '*' : '';
                return `${prefix}${param.name}${defaultValue}${required}`;
            })
            .join(', ');
    }
}