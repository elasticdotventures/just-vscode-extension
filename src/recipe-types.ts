/**
 * Recipe management types and interfaces
 * Based on vscode-just.subrepo recipe system
 */

export enum RecipeParameterKind {
    SINGULAR = 'singular',
    PLUS = 'plus',
}

export interface RecipeParameter {
    name: string;
    kind: RecipeParameterKind;
    default: string | null;
    [key: string]: unknown;
}

export interface RecipeAttribute {
    [key: string]: string;
}

export interface RecipeResponse {
    name: string;
    doc: string;
    parameters: RecipeParameter[];
    attributes: (RecipeAttribute | string)[];
    private: boolean;
    [key: string]: unknown;
}

export interface RecipeParsed {
    name: string;
    doc: string;
    parameters: Pick<RecipeParameter, 'name' | 'kind' | 'default'>[];
    groups: string[];
    private: boolean;
    attributes: (RecipeAttribute | string)[];
}

export interface JustDumpResponse {
    recipes: Record<string, RecipeResponse>;
    [key: string]: unknown;
}

export interface RecipeExecutionOptions {
    recipeName: string;
    parameters: Record<string, string | string[]>;
    workingDirectory?: string;
    runInTerminal?: boolean;
    useSingleTerminal?: boolean;
}

export interface RecipeQuickPickItem {
    label: string;
    description?: string;
    detail?: string;
    recipe: RecipeParsed;
}